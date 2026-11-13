package kr.sweetwo.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 앱 안 플러그인은 super.onCreate 전에 등록(Capacitor 문서 ‘Custom Native Android Code’)
        registerPlugin(AppSettingsPlugin.class);
        registerPlugin(HomeWidgetPlugin.class);
        registerPlugin(InviteCodePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
