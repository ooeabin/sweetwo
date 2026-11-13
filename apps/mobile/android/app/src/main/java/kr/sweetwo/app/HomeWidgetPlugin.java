package kr.sweetwo.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 홈 화면 위젯 값 쓰기(apps/mobile/src/native/widget.ts). write: 앱이 만든 글(JSON, 금액 없음), setLock: 잠금 시각,
 * clear: 로그아웃. 쓴 뒤 위젯을 바로 다시 그림(26 ‘갱신’ 앱에서 값이 바뀌면 바로)
 */
@CapacitorPlugin(name = "HomeWidget")
public class HomeWidgetPlugin extends Plugin {
    private static final int MAX_JSON = 8 * 1024;

    @PluginMethod
    public void write(PluginCall call) {
        String json = call.getString("json");
        if (json == null || json.length() > MAX_JSON) {
            call.reject("bad_json");
            return;
        }
        WidgetStore.write(getContext(), json);
        call.resolve();
    }

    @PluginMethod
    public void setLock(PluginCall call) {
        JSObject data = call.getData();
        long at = -1L;
        if (data.has("lockAt") && !data.isNull("lockAt")) {
            at = (long) data.optDouble("lockAt", -1d);
        }
        WidgetStore.setLock(getContext(), at);
        call.resolve();
    }

    @PluginMethod
    public void clear(PluginCall call) {
        WidgetStore.clear(getContext());
        call.resolve();
    }
}
