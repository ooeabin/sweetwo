import UIKit
import Capacitor
import AuthenticationServices
import WidgetKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = MainViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

/// 앱 안 플러그인을 붙이는 화면(Capacitor 문서 ‘Custom Native iOS Code’)
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(WebAuthPlugin())
        bridge?.registerPluginInstance(AppSettingsPlugin())
        bridge?.registerPluginInstance(HomeWidgetPlugin())
        bridge?.registerPluginInstance(InviteCodePlugin())
    }
}

/// 소셜 로그인 창(기획서 A-03, DEV_GUIDE ‘모바일 세션’): ASWebAuthenticationSession.
/// 로그인이 끝나 웹 콜백 페이지가 sweetwo://auth/callback으로 넘기면 창이 닫히며 그 주소를 웹뷰(apps/mobile/src/native/auth.ts)에 돌려줌.
/// 주소는 https만 열고, 돌려준 값은 웹뷰가 허용 목록(core deep-link.ts)으로 다시 확인함.
@objc(WebAuthPlugin)
public class WebAuthPlugin: CAPPlugin, CAPBridgedPlugin, ASWebAuthenticationPresentationContextProviding {
    public let identifier = "WebAuthPlugin"
    public let jsName = "WebAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise)
    ]
    private var session: ASWebAuthenticationSession?

    @objc func start(_ call: CAPPluginCall) {
        guard let raw = call.getString("url"), let url = URL(string: raw), url.scheme == "https" else {
            call.reject("bad_url")
            return
        }
        let scheme = call.getString("callbackScheme") ?? "sweetwo"
        DispatchQueue.main.async {
            self.session?.cancel()
            let s = ASWebAuthenticationSession(url: url, callbackURLScheme: scheme) { [weak self] callback, error in
                self?.session = nil
                if let callback = callback {
                    call.resolve(["url": callback.absoluteString])
                } else if let e = error as? ASWebAuthenticationSessionError, e.code == .canceledLogin {
                    call.resolve(["cancelled": true])
                } else {
                    call.reject("failed")
                }
            }
            s.presentationContextProvider = self
            s.prefersEphemeralWebBrowserSession = false
            self.session = s
            if !s.start() {
                self.session = nil
                call.reject("start_failed")
            }
        }
    }

    @objc func cancel(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.session?.cancel()
            self.session = nil
            call.resolve()
        }
    }

    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return bridge?.viewController?.view.window ?? ASPresentationAnchor()
    }
}

/// 휴대폰 설정의 이 앱 알림 화면 열기(기획서 S-14 ‘설정 열기’, 2026-11-12). iOS 16+는 알림 설정, 그 전은 앱 설정
@objc(AppSettingsPlugin)
public class AppSettingsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppSettingsPlugin"
    public let jsName = "AppSettings"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "openNotifications", returnType: CAPPluginReturnPromise)
    ]

    @objc func openNotifications(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            var raw = UIApplication.openSettingsURLString
            if #available(iOS 16.0, *) {
                raw = UIApplication.openNotificationSettingsURLString
            }
            guard let url = URL(string: raw) else {
                call.reject("no_url")
                return
            }
            UIApplication.shared.open(url, options: [:]) { ok in
                if ok { call.resolve() } else { call.reject("open_failed") }
            }
        }
    }
}

/// 홈 화면 위젯 값 쓰기(기획서 26 ‘위젯 v2.2’, apps/mobile/src/native/widget.ts). App Group(group.kr.sweetwo.app) UserDefaults에
/// 앱이 만든 글(JSON, 금액 없음)과 잠금 시각만 둠. 토큰·세션은 넣지 않음. 위젯 확장(SweetwoWidget)이 같은 키를 읽음
@objc(HomeWidgetPlugin)
public class HomeWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HomeWidgetPlugin"
    public let jsName = "HomeWidget"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "write", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setLock", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "installed", returnType: CAPPluginReturnPromise)
    ]
    static let group = "group.kr.sweetwo.app"
    private var store: UserDefaults? { UserDefaults(suiteName: HomeWidgetPlugin.group) }

    private func reload() {
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
    }

    @objc func write(_ call: CAPPluginCall) {
        guard let json = call.getString("json"), json.utf8.count <= 8 * 1024 else {
            call.reject("bad_json")
            return
        }
        store?.set(json, forKey: "data")
        reload()
        call.resolve()
    }

    @objc func setLock(_ call: CAPPluginCall) {
        // lockAt(ms). null이면 잠금 없음
        if let at = call.getDouble("lockAt") {
            store?.set(at, forKey: "lockAt")
        } else {
            store?.removeObject(forKey: "lockAt")
        }
        reload()
        call.resolve()
    }

    @objc func clear(_ call: CAPPluginCall) {
        store?.removeObject(forKey: "data")
        store?.removeObject(forKey: "lockAt")
        reload()
        call.resolve()
    }

    /// 홈 화면에 놓인 위젯(종류, 크기). 앱이 처음 본 것만 widget_added로 보냄(32 4-7, 2026-11-13 PR 14). 개수·위치는 보내지 않음
    @objc func installed(_ call: CAPPluginCall) {
        guard #available(iOS 14.0, *) else {
            call.resolve(["items": []])
            return
        }
        WidgetCenter.shared.getCurrentConfigurations { result in
            var items: [[String: String]] = []
            if case .success(let infos) = result {
                for info in infos {
                    let w = info.kind == "kr.sweetwo.widget.save" ? "wg01" : info.kind == "kr.sweetwo.widget.next" ? "wg04" : ""
                    if w.isEmpty { continue }
                    items.append(["widget": w, "size": info.family == .systemMedium ? "medium" : "small"])
                }
            }
            call.resolve(["items": items])
        }
    }
}

/// 첫 실행 초대 코드(기획서 15 O-01, 31 2장): 클립보드를 이 호출 때 한 번만 읽음. 글이 있을 때만 읽어(iOS가 ‘붙여넣기 허용’을 물음)
/// 그대로 웹뷰에 넘기고, 코드 모양 확인은 웹뷰(invite-code.ts). 저장·전송하지 않음. 설치 리퍼러는 Android 전용
@objc(InviteCodePlugin)
public class InviteCodePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "InviteCodePlugin"
    public let jsName = "InviteCode"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "readClipboardOnce", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "installReferrer", returnType: CAPPluginReturnPromise)
    ]

    @objc func readClipboardOnce(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let board = UIPasteboard.general
            guard board.hasStrings, let text = board.string, text.count <= 64 else {
                call.resolve([:])
                return
            }
            call.resolve(["text": text])
        }
    }

    @objc func installReferrer(_ call: CAPPluginCall) {
        call.resolve([:])
    }
}
