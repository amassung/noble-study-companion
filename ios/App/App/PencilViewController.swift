import UIKit
import WebKit
import Capacitor

/**
 Forwards Apple Pencil hardware gestures into the web layer.

 WebKit does not surface the Pencil's squeeze or double-tap to web content —
 there is no event a page can listen for — so a web app cannot reach them at
 all. The app receives them natively here and re-dispatches them as a DOM
 event, which is the only route across.

 The web side listens for `nobi:pencil` and decides what each gesture does;
 keeping the mapping over there means changing it ships through the normal
 web deploy rather than another trip through the App Store.
 */
class PencilViewController: CAPBridgeViewController {
  private let pencilInteraction = UIPencilInteraction()

  override func viewDidLoad() {
    super.viewDidLoad()
    pencilInteraction.delegate = self
    view.addInteraction(pencilInteraction)
  }

  /// Hand a gesture to the web layer as a DOM event.
  fileprivate func notifyWeb(_ gesture: String) {
    // The gesture names are literals declared in this file, never user input,
    // so there is nothing here to escape.
    let js = """
      window.dispatchEvent(new CustomEvent('nobi:pencil', \
      { detail: { gesture: '\(gesture)' } }))
      """
    DispatchQueue.main.async { [weak self] in
      self?.bridge?.webView?.evaluateJavaScript(js, completionHandler: nil)
    }
  }
}

extension PencilViewController: UIPencilInteractionDelegate {
  /// Apple Pencil Pro squeeze. Pro hardware and iOS 17.5 or newer only.
  @available(iOS 17.5, *)
  func pencilInteraction(
    _ interaction: UIPencilInteraction,
    didReceiveSqueeze squeeze: UIPencilInteraction.Squeeze
  ) {
    // Fire once per squeeze, when the fingers let go. `.changed` arrives
    // continuously while held and would open and close the menu repeatedly.
    guard squeeze.phase == .ended else { return }
    notifyWeb("squeeze")
  }

  /// Double-tap, on Pencil 2 and Pencil Pro.
  func pencilInteractionDidTap(_ interaction: UIPencilInteraction) {
    notifyWeb("doubletap")
  }
}
