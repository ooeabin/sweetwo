package kr.sweetwo.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONObject;

/**
 * WG-01 같이 모으기(기획서 26 ‘위젯 v2.2’). 대표 저금 이름 + 큰 %(목표 금액이 없으면 “모으는 중”). 중(가로 넓게)은 얇은 막대와
 * “2027년 5월까지”. 금액은 없음(기본 가림, 라벨 옆 눈 끔). 누르면 그 저금(W-10). 저금이 없으면 “무엇을 같이 모을까요?” → 홈
 */
public class SaveTogetherWidget extends AppWidgetProvider {
    /** 이 너비(dp) 이상이면 중 */
    private static final int MEDIUM_DP = 200;

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) render(context, manager, id);
    }

    @Override
    public void onAppWidgetOptionsChanged(
            Context context, AppWidgetManager manager, int id, Bundle options) {
        render(context, manager, id);
    }

    static void updateAll(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        for (int id : WidgetStore.ids(c, SaveTogetherWidget.class)) render(c, m, id);
    }

    private static void render(Context c, AppWidgetManager m, int id) {
        int req = id * 2;
        JSONObject d = WidgetStore.data(c);
        RemoteViews gate = WidgetStore.gate(c, d, req);
        if (gate != null) {
            m.updateAppWidget(id, gate);
            return;
        }
        JSONObject s = d.optJSONObject("save");
        String name = WidgetStore.str(s, "name");
        String big = WidgetStore.str(s, "big");
        if (s == null || name == null || big == null) {
            m.updateAppWidget(
                    id,
                    WidgetStore.message(
                            c,
                            c.getString(R.string.widget_save_name),
                            R.string.widget_save_empty,
                            false,
                            false,
                            WidgetStore.openPath(c, "/", req)));
            return;
        }
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_save);
        v.setTextViewText(R.id.widget_name, name);
        v.setTextViewText(R.id.widget_big, big);
        Bundle o = m.getAppWidgetOptions(id);
        boolean medium = o != null && o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0) >= MEDIUM_DP;
        boolean hasPct = s.has("pct") && !s.isNull("pct");
        if (medium && hasPct) {
            v.setProgressBar(R.id.widget_bar, 100, Math.max(0, Math.min(100, s.optInt("pct", 0))), false);
            v.setViewVisibility(R.id.widget_bar, View.VISIBLE);
        } else {
            v.setViewVisibility(R.id.widget_bar, View.GONE);
        }
        String line = WidgetStore.str(s, "line");
        if (medium && line != null) {
            v.setTextViewText(R.id.widget_line, line);
            v.setViewVisibility(R.id.widget_line, View.VISIBLE);
        } else {
            v.setViewVisibility(R.id.widget_line, View.GONE);
        }
        String done = WidgetStore.str(s, "done");
        if (done != null) {
            v.setTextViewText(R.id.widget_done, done);
            v.setViewVisibility(R.id.widget_done, View.VISIBLE);
        } else {
            v.setViewVisibility(R.id.widget_done, View.GONE);
        }
        WidgetStore.setStamp(v, WidgetStore.stamp(c, d));
        v.setOnClickPendingIntent(R.id.widget_root, WidgetStore.openPath(c, WidgetStore.str(s, "to"), req));
        m.updateAppWidget(id, v);
    }
}
