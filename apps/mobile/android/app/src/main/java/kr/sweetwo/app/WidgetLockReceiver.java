package kr.sweetwo.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** 자동 잠금 시각이 되면 위젯을 다시 그림(값 없이 “잠겨 있어요”, 26 ‘앱이 잠겨 있으면’) */
public class WidgetLockReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        WidgetStore.refreshAll(context);
    }
}
