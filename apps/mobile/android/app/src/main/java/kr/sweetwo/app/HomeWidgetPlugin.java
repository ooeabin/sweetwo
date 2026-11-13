package kr.sweetwo.app;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.os.Bundle;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 홈 화면 위젯 값 쓰기(apps/mobile/src/native/widget.ts). write: 앱이 만든 글(JSON, 금액 없음), setLock: 잠금 시각,
 * clear: 로그아웃, installed: 놓인 위젯 종류·크기(widget_added 분석, 2026-11-13 PR 14). 쓴 뒤 위젯을 바로 다시 그림(26 ‘갱신’ 앱에서 값이 바뀌면 바로)
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

    @PluginMethod
    public void installed(PluginCall call) {
        AppWidgetManager m = AppWidgetManager.getInstance(getContext());
        JSArray items = new JSArray();
        for (int id : m.getAppWidgetIds(new ComponentName(getContext(), SaveTogetherWidget.class))) {
            Bundle o = m.getAppWidgetOptions(id);
            boolean medium = o != null && o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0) >= SaveTogetherWidget.MEDIUM_DP;
            items.put(item("wg01", medium ? "medium" : "small"));
        }
        for (int ignored : m.getAppWidgetIds(new ComponentName(getContext(), UpcomingWidget.class))) {
            items.put(item("wg04", "small"));
        }
        JSObject r = new JSObject();
        r.put("items", items);
        call.resolve(r);
    }

    private static JSObject item(String widget, String size) {
        JSObject x = new JSObject();
        x.put("widget", widget);
        x.put("size", size);
        return x;
    }
}
