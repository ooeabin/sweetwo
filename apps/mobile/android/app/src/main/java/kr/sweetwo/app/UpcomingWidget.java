package kr.sweetwo.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.widget.RemoteViews;
import org.json.JSONObject;

/**
 * WG-04 다가오는 날(기획서 26 ‘위젯 v2.2’). 가장 가까운 경조사 또는 쓸 곳 메모 이름 + “D-13”(그날 KST로 셈).
 * 메모 금액은 없음. 누르면 Y-05 / W-14. 없거나 지났으면 “다가오는 날이 없어요” → 캘린더(Y-01)
 */
public class UpcomingWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) render(context, manager, id);
    }

    static void updateAll(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        for (int id : WidgetStore.ids(c, UpcomingWidget.class)) render(c, m, id);
    }

    private static void render(Context c, AppWidgetManager m, int id) {
        int req = id * 2 + 1;
        JSONObject d = WidgetStore.data(c);
        RemoteViews gate = WidgetStore.gate(c, d, req);
        if (gate != null) {
            m.updateAppWidget(id, gate);
            return;
        }
        JSONObject n = d.optJSONObject("next");
        String name = WidgetStore.str(n, "name");
        Integer days = WidgetStore.daysUntil(WidgetStore.str(n, "date"));
        if (name == null || days == null || days < 0) {
            m.updateAppWidget(
                    id,
                    WidgetStore.message(
                            c,
                            c.getString(R.string.widget_next_name),
                            R.string.widget_next_empty,
                            false,
                            false,
                            WidgetStore.openPath(c, "/calendar", "wg04", req)));
            return;
        }
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_next);
        v.setTextViewText(R.id.widget_name, name);
        v.setTextViewText(
                R.id.widget_big,
                days == 0 ? c.getString(R.string.widget_dday) : c.getString(R.string.widget_dn, days));
        WidgetStore.setStamp(v, WidgetStore.stamp(c, d));
        v.setOnClickPendingIntent(R.id.widget_root, WidgetStore.openPath(c, WidgetStore.str(n, "to"), "wg04", req));
        m.updateAppWidget(id, v);
    }
}
