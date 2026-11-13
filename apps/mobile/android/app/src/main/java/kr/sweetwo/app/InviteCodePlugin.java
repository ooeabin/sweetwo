package kr.sweetwo.app;

import android.os.RemoteException;
import com.android.installreferrer.api.InstallReferrerClient;
import com.android.installreferrer.api.InstallReferrerStateListener;
import com.android.installreferrer.api.ReferrerDetails;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * 첫 실행 초대 코드(기획서 15 O-01, 31 2장): Google Play 설치 리퍼러 글만 돌려줌(웹사이트 L-07이 referrer=invite_{코드}를 붙임).
 * 코드 모양 확인은 웹뷰(apps/mobile/src/native/invite-code.ts). 클립보드는 Android에서 읽지 않음
 */
@CapacitorPlugin(name = "InviteCode")
public class InviteCodePlugin extends Plugin {
    @PluginMethod
    public void installReferrer(PluginCall call) {
        final AtomicBoolean done = new AtomicBoolean(false);
        final InstallReferrerClient client;
        try {
            client = InstallReferrerClient.newBuilder(getContext()).build();
        } catch (Exception e) {
            call.resolve(new JSObject());
            return;
        }
        try {
            client.startConnection(new InstallReferrerStateListener() {
                @Override
                public void onInstallReferrerSetupFinished(int code) {
                    if (!done.compareAndSet(false, true)) return;
                    JSObject ret = new JSObject();
                    if (code == InstallReferrerClient.InstallReferrerResponse.OK) {
                        try {
                            ReferrerDetails d = client.getInstallReferrer();
                            String r = d.getInstallReferrer();
                            if (r != null && r.length() <= 1024) ret.put("referrer", r);
                        } catch (RemoteException | RuntimeException e) {
                            // 없음
                        }
                    }
                    call.resolve(ret);
                    try {
                        client.endConnection();
                    } catch (RuntimeException e) {
                        // 무시
                    }
                }

                @Override
                public void onInstallReferrerServiceDisconnected() {
                    if (done.compareAndSet(false, true)) call.resolve(new JSObject());
                }
            });
        } catch (RuntimeException e) {
            if (done.compareAndSet(false, true)) call.resolve(new JSObject());
        }
    }

    /** iOS 전용(Android는 클립보드를 읽지 않음) */
    @PluginMethod
    public void readClipboardOnce(PluginCall call) {
        call.resolve(new JSObject());
    }
}
