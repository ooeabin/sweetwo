package kr.sweetwo.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import org.json.JSONObject;

/**
 * 홈 화면 위젯 저장소(기획서 26 ‘위젯 v2.2’, DEV_GUIDE ‘위젯’). 앱 전용 SharedPreferences(백업 제외)에 앱이 넘긴 글(JSON)과
 * 잠금 시각만 둔다. 금액·토큰·세션은 없음. 로그아웃하면 지움 → 로그인 전 카드.
 */
final class WidgetStore {
    private static final String PREFS = "sweetwo_widget";
    private static final String DATA = "data";
    private static final String LOCK_AT = "lockAt";
    private static final TimeZone KST = TimeZone.getTimeZone("Asia/Seoul");
    private static final long STALE_MS = 30L * 60L * 1000L;

    private WidgetStore() {}

    private static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static void write(Context c, String json) {
        prefs(c).edit().putString(DATA, json).commit();
        refreshAll(c);
    }

    /** lockAt(ms) 뒤에는 “잠겨 있어요”. 음수 = 잠금 없음 */
    static void setLock(Context c, long lockAt) {
        prefs(c).edit().putLong(LOCK_AT, lockAt).commit();
        if (lockAt > System.currentTimeMillis()) scheduleRefresh(c, lockAt);
        refreshAll(c);
    }

    static void clear(Context c) {
        prefs(c).edit().clear().commit();
        refreshAll(c);
    }

    static void refreshAll(Context c) {
        SaveTogetherWidget.updateAll(c);
        UpcomingWidget.updateAll(c);
    }

    static boolean locked(Context c) {
        long at = prefs(c).getLong(LOCK_AT, -1L);
        return at >= 0 && System.currentTimeMillis() >= at;
    }

    /** 앱이 넘긴 값. 없으면(로그인 전·로그아웃 뒤) null */
    static JSONObject data(Context c) {
        String raw = prefs(c).getString(DATA, null);
        if (raw == null) return null;
        try {
            return new JSONObject(raw);
        } catch (Exception e) {
            return null;
        }
    }

    /** JSON 글 값. 없거나 null이면 null(optString은 "null"을 돌려주므로 쓰지 않음) */
    static String str(JSONObject o, String key) {
        if (o == null || !o.has(key) || o.isNull(key)) return null;
        Object v = o.opt(key);
        return v instanceof String ? (String) v : null;
    }

    /** 오늘(KST)부터 그날(yyyy-MM-dd)까지 날 수. 읽지 못하면 null */
    static Integer daysUntil(String ymd) {
        if (ymd == null || !ymd.matches("\\d{4}-\\d{2}-\\d{2}")) return null;
        Calendar now = Calendar.getInstance(KST);
        Calendar a = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
        a.clear();
        a.set(now.get(Calendar.YEAR), now.get(Calendar.MONTH), now.get(Calendar.DAY_OF_MONTH));
        Calendar b = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
        b.clear();
        b.set(
                Integer.parseInt(ymd.substring(0, 4)),
                Integer.parseInt(ymd.substring(5, 7)) - 1,
                Integer.parseInt(ymd.substring(8, 10)));
        return (int) ((b.getTimeInMillis() - a.getTimeInMillis()) / 86_400_000L);
    }

    /** 마지막 저장이 30분보다 오래면 “오전 10:30 기준”(26 ‘상태’ 오프라인), 아니면 null */
    static String stamp(Context c, JSONObject d) {
        long at = d.optLong("savedAt", 0L);
        if (at <= 0 || System.currentTimeMillis() - at < STALE_MS) return null;
        SimpleDateFormat f = new SimpleDateFormat("a h:mm", Locale.KOREAN);
        f.setTimeZone(KST);
        return c.getString(R.string.widget_stamp, f.format(new Date(at)));
    }

    static void setStamp(RemoteViews v, String stamp) {
        if (stamp == null) {
            v.setViewVisibility(R.id.widget_stamp, View.GONE);
        } else {
            v.setTextViewText(R.id.widget_stamp, stamp);
            v.setViewVisibility(R.id.widget_stamp, View.VISIBLE);
        }
    }

    /** 앱 화면 열기(sweetwo://widget?to=…&w=…, core deep-link.ts 허용 목록). w = wg01 / wg04(widget_tapped 분석만) */
    static PendingIntent openPath(Context c, String path, String widget, int request) {
        Uri uri = new Uri.Builder()
                .scheme("sweetwo")
                .authority("widget")
                .appendQueryParameter("to", path == null ? "/" : path)
                .appendQueryParameter("w", widget)
                .build();
        Intent i = new Intent(Intent.ACTION_VIEW, uri, c, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(
                c, request, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** 앱만 열기(로그인 전, 잠김) */
    static PendingIntent openApp(Context c, int request) {
        Intent i = new Intent(c, MainActivity.class);
        i.setAction(Intent.ACTION_MAIN);
        i.addCategory(Intent.CATEGORY_LAUNCHER);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(
                c, request, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** 상태 카드: label(없으면 숨김) + 자물쇠 + 글 + ‘앱 열기’ */
    static RemoteViews message(
            Context c, String label, int text, boolean lock, boolean openLine, PendingIntent tap) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_message);
        if (label != null) {
            v.setTextViewText(R.id.widget_label, label);
            v.setViewVisibility(R.id.widget_label, View.VISIBLE);
        }
        v.setViewVisibility(R.id.widget_lock, lock ? View.VISIBLE : View.GONE);
        v.setTextViewText(R.id.widget_text, c.getString(text));
        v.setViewVisibility(R.id.widget_open, openLine ? View.VISIBLE : View.GONE);
        v.setOnClickPendingIntent(R.id.widget_root, tap);
        return v;
    }

    /** 로그인 전·잠김이면 그 카드, 아니면 null */
    static RemoteViews gate(Context c, JSONObject d, int request) {
        if (d == null)
            return message(c, null, R.string.widget_login, false, false, openApp(c, request));
        if (locked(c)) return message(c, null, R.string.widget_locked, true, true, openApp(c, request));
        return null;
    }

    static int[] ids(Context c, Class<?> provider) {
        return AppWidgetManager.getInstance(c).getAppWidgetIds(new ComponentName(c, provider));
    }

    /** 잠금 시각에 위젯을 다시 그리게(정확하지 않아도 됨, 권한 없는 알람) */
    private static void scheduleRefresh(Context c, long at) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        Intent i = new Intent(c, WidgetLockReceiver.class);
        PendingIntent p = PendingIntent.getBroadcast(
                c, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        am.set(AlarmManager.RTC, at, p);
    }
}
