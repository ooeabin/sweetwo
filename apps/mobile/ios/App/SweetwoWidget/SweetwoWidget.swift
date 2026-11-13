import SwiftUI
import UIKit
import WidgetKit

// 홈 화면 위젯(기획서 26 ‘위젯 v2.2’, DEV_GUIDE ‘위젯’). WG-01 같이 모으기(소·중), WG-04 다가오는 날(소).
// 값은 앱(HomeWidgetPlugin, SceneDelegate.swift)이 App Group(group.kr.sweetwo.app) UserDefaults에 쓴 글(JSON)만 읽음.
// 서버를 부르지 않고 토큰도 없음. 금액은 없음(기본 가림, 라벨 옆 눈 끔). 잠금 시각(lockAt) 뒤에는 값 없이 “잠겨 있어요”.
// 아이콘은 Phosphor(lock, eye-slash, docs/design 아이콘과 같은 모양, 이 폴더 Assets.xcassets). 문구는 Android res/values/widget_strings.xml과 같게. 색은 docs/design/tokens.css 값 그대로(라이트/다크).
// 이 파일은 Xcode의 위젯 확장 타깃(SweetwoWidget)에 넣음 → docs/DEV_GUIDE.md ‘위젯’ Xcode 순서

private let appGroup = "group.kr.sweetwo.app"
private let kst = TimeZone(identifier: "Asia/Seoul")!

// MARK: 문구(26)
private enum T {
    static let saveName = "같이 모으기"
    static let saveDesc = "같이 모으는 저금이 얼마나 모였는지 봐요" // [확인 필요]
    static let nextName = "다가오는 날"
    static let nextDesc = "가장 가까운 경조사나 쓸 곳 메모 날짜를 봐요" // [확인 필요]
    static let login = "sweeTwo를 열어 로그인해 주세요"
    static let locked = "잠겨 있어요"
    static let open = "앱 열기"
    static let saveEmpty = "무엇을 같이 모을까요?" // [확인 필요] H-10 빈 상태 질문
    static let nextEmpty = "다가오는 날이 없어요"
    static let amountHidden = "금액 가림"
    static func dday(_ n: Int) -> String { n == 0 ? "D-day" : "D-\(n)" }
    static func stamp(_ t: String) -> String { "\(t) 기준" }
}

// MARK: 색(tokens.css)
private func dyn(_ light: UInt32, _ dark: UInt32) -> Color {
    func c(_ v: UInt32) -> UIColor {
        UIColor(red: CGFloat((v >> 16) & 0xff) / 255, green: CGFloat((v >> 8) & 0xff) / 255,
                blue: CGFloat(v & 0xff) / 255, alpha: 1)
    }
    return Color(UIColor { $0.userInterfaceStyle == .dark ? c(dark) : c(light) })
}
private enum C {
    static let surface = dyn(0xffffff, 0x121315)
    static let goal = dyn(0xf6eee5, 0x2e2620)
    static let goalInk = dyn(0x6b4a2b, 0xe8cfb2)
    static let ink = dyn(0x1a1b1c, 0xeff0f2)
    static let slate = dyn(0x545557, 0xafb0b2)
    static let brand = dyn(0xff7716, 0xff9045)
    static let brandSoft = dyn(0xfff2e8, 0x3a2214)
}

// MARK: 값
struct WidgetSave: Decodable {
    let name: String
    let big: String
    let pct: Int?
    let line: String?
    let done: String?
    let to: String
}
struct WidgetNext: Decodable {
    let name: String
    let date: String
    let to: String
}
struct WidgetPayload: Decodable {
    let savedAt: Double
    let save: WidgetSave?
    let next: WidgetNext?
}

enum WidgetState {
    case login
    case locked
    case data(WidgetPayload)
}

struct SweetwoEntry: TimelineEntry {
    let date: Date
    let state: WidgetState
}

private func readStore() -> (WidgetPayload?, Date?) {
    let d = UserDefaults(suiteName: appGroup)
    var payload: WidgetPayload?
    if let raw = d?.string(forKey: "data"), let data = raw.data(using: .utf8) {
        payload = try? JSONDecoder().decode(WidgetPayload.self, from: data)
    }
    var lockAt: Date?
    if let ms = d?.object(forKey: "lockAt") as? Double { lockAt = Date(timeIntervalSince1970: ms / 1000) }
    return (payload, lockAt)
}

/// 오늘(KST)부터 yyyy-MM-dd까지 날 수
private func daysUntil(_ ymd: String, from now: Date) -> Int? {
    var cal = Calendar(identifier: .gregorian)
    cal.timeZone = kst
    let f = DateFormatter()
    f.calendar = cal
    f.timeZone = kst
    f.locale = Locale(identifier: "en_US_POSIX")
    f.dateFormat = "yyyy-MM-dd"
    guard let target = f.date(from: ymd) else { return nil }
    return cal.dateComponents([.day], from: cal.startOfDay(for: now), to: cal.startOfDay(for: target)).day
}

/// 마지막 저장이 30분보다 오래면 “오전 10:30 기준”(26 ‘상태’ 오프라인)
private func stamp(_ p: WidgetPayload, now: Date) -> String? {
    let saved = Date(timeIntervalSince1970: p.savedAt / 1000)
    guard now.timeIntervalSince(saved) >= 30 * 60 else { return nil }
    let f = DateFormatter()
    f.locale = Locale(identifier: "ko_KR")
    f.timeZone = kst
    f.dateFormat = "a h:mm"
    return T.stamp(f.string(from: saved))
}

private func link(_ path: String) -> URL? {
    var c = URLComponents()
    c.scheme = "sweetwo"
    c.host = "widget"
    c.queryItems = [URLQueryItem(name: "to", value: path)]
    return c.url
}

// MARK: 시간표: 지금, 잠금 시각, 다음 KST 자정(D-n), 그 뒤 30분마다(26 ‘갱신’)
struct SweetwoProvider: TimelineProvider {
    func placeholder(in context: Context) -> SweetwoEntry { SweetwoEntry(date: Date(), state: .login) }

    func getSnapshot(in context: Context, completion: @escaping (SweetwoEntry) -> Void) {
        completion(entry(at: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SweetwoEntry>) -> Void) {
        let now = Date()
        var dates = [now]
        let (_, lockAt) = readStore()
        if let l = lockAt, l > now { dates.append(l) }
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = kst
        if let midnight = cal.nextDate(after: now, matching: DateComponents(hour: 0, minute: 0), matchingPolicy: .nextTime) {
            dates.append(midnight)
        }
        let entries = dates.sorted().map { entry(at: $0) }
        completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(30 * 60))))
    }

    private func entry(at date: Date) -> SweetwoEntry {
        let (payload, lockAt) = readStore()
        guard let p = payload else { return SweetwoEntry(date: date, state: .login) }
        if let l = lockAt, date >= l { return SweetwoEntry(date: date, state: .locked) }
        return SweetwoEntry(date: date, state: .data(p))
    }
}

// MARK: 화면
private struct CardBackground: ViewModifier {
    let color: Color
    @ViewBuilder
    func body(content: Content) -> some View {
        if #available(iOS 17.0, *) {
            content.containerBackground(for: .widget) { color }
        } else {
            content.padding(16).background(color)
        }
    }
}
private extension View {
    func card(_ color: Color) -> some View { modifier(CardBackground(color: color)) }
}

private struct MessageView: View {
    let label: String?
    let text: String
    let lock: Bool
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let label = label {
                Text(label).font(.system(size: 12, weight: .bold)).foregroundColor(C.slate).lineLimit(1)
            }
            if lock {
                Image("widget-lock").resizable().renderingMode(.template).frame(width: 24, height: 24)
                    .foregroundColor(C.ink).accessibilityHidden(true)
            }
            Text(text).font(.system(size: 15, weight: .bold)).foregroundColor(C.ink).lineLimit(3)
            if lock {
                Text(T.open).font(.system(size: 13, weight: .bold)).foregroundColor(C.slate)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}

private struct StampView: View {
    let text: String?
    @ViewBuilder
    var body: some View {
        if let t = text {
            HStack { Spacer(); Text(t).font(.system(size: 11)).foregroundColor(C.slate).lineLimit(1) }
        }
    }
}

struct SaveTogetherView: View {
    let entry: SweetwoEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch entry.state {
        case .login:
            MessageView(label: nil, text: T.login, lock: false).card(C.surface)
        case .locked:
            MessageView(label: nil, text: T.locked, lock: true).card(C.surface)
        case .data(let p):
            if let s = p.save {
                content(s, p).card(C.goal).widgetURL(link(s.to))
            } else {
                MessageView(label: T.saveName, text: T.saveEmpty, lock: false).card(C.surface).widgetURL(link("/"))
            }
        }
    }

    private func content(_ s: WidgetSave, _ p: WidgetPayload) -> some View {
        let medium = family == .systemMedium
        return VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 4) {
                Text(T.saveName).font(.system(size: 12, weight: .bold)).foregroundColor(C.goalInk).lineLimit(1)
                Image("widget-eye-slash").resizable().renderingMode(.template).frame(width: 12, height: 12)
                    .foregroundColor(C.goalInk).accessibilityLabel(T.amountHidden)
            }
            Text(s.name).font(.system(size: 14, weight: .bold)).foregroundColor(C.ink).lineLimit(1).padding(.top, 2)
            Text(s.big).font(.system(size: 32, weight: .bold)).foregroundColor(C.ink).lineLimit(1)
                .minimumScaleFactor(0.6)
            if medium, let pct = s.pct {
                GeometryReader { g in
                    ZStack(alignment: .leading) {
                        Capsule().fill(C.surface)
                        Capsule().fill(C.brand).frame(width: g.size.width * CGFloat(max(0, min(100, pct))) / 100)
                    }
                }
                .frame(height: 6)
                .padding(.top, 6)
                .accessibilityHidden(true)
            }
            if medium, let line = s.line {
                Text(line).font(.system(size: 12)).foregroundColor(C.slate).lineLimit(1).padding(.top, 4)
            }
            if let done = s.done {
                Text(done).font(.system(size: 14, weight: .bold)).foregroundColor(C.brand)
                    .padding(.horizontal, 8).padding(.vertical, 2)
                    .background(Capsule().fill(C.brandSoft)).padding(.top, 4)
            }
            Spacer(minLength: 0)
            StampView(text: stamp(p, now: entry.date))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

struct UpcomingView: View {
    let entry: SweetwoEntry

    var body: some View {
        switch entry.state {
        case .login:
            MessageView(label: nil, text: T.login, lock: false).card(C.surface)
        case .locked:
            MessageView(label: nil, text: T.locked, lock: true).card(C.surface)
        case .data(let p):
            if let n = p.next, let days = daysUntil(n.date, from: entry.date), days >= 0 {
                VStack(alignment: .leading, spacing: 2) {
                    Text(T.nextName).font(.system(size: 12, weight: .bold)).foregroundColor(C.slate).lineLimit(1)
                    Text(n.name).font(.system(size: 15, weight: .bold)).foregroundColor(C.ink).lineLimit(2).padding(.top, 2)
                    Text(T.dday(days)).font(.system(size: 32, weight: .bold)).foregroundColor(C.ink).lineLimit(1)
                    Spacer(minLength: 0)
                    StampView(text: stamp(p, now: entry.date))
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .card(C.surface)
                .widgetURL(link(n.to))
            } else {
                MessageView(label: T.nextName, text: T.nextEmpty, lock: false).card(C.surface).widgetURL(link("/calendar"))
            }
        }
    }
}

// MARK: 위젯
struct SaveTogetherWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "kr.sweetwo.widget.save", provider: SweetwoProvider()) { SaveTogetherView(entry: $0) }
            .configurationDisplayName(T.saveName)
            .description(T.saveDesc)
            .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct UpcomingWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "kr.sweetwo.widget.next", provider: SweetwoProvider()) { UpcomingView(entry: $0) }
            .configurationDisplayName(T.nextName)
            .description(T.nextDesc)
            .supportedFamilies([.systemSmall])
    }
}

@main
struct SweetwoWidgets: WidgetBundle {
    var body: some Widget {
        SaveTogetherWidget()
        UpcomingWidget()
    }
}
