//
//  AppDelegate.swift
//  Runner
//
//  Based on the Even Realities EvenDemoApp (BSD-2-Clause).
//  Adds: speech language from Flutter, UserDefaults prefs and Keychain storage for the API key.
//

import UIKit
import Flutter
import Security

@main
@objc class AppDelegate: FlutterAppDelegate {

    private var blueInstance = BluetoothManager.shared

    override func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {

        GeneratedPluginRegistrant.register(with: self)
        let controller = window?.rootViewController as! FlutterViewController
        let messenger : FlutterBinaryMessenger = window?.rootViewController as! FlutterBinaryMessenger
        let channel = FlutterMethodChannel(name: "method.bluetooth", binaryMessenger: controller.binaryMessenger)

        blueInstance = BluetoothManager(channel: channel)

        channel.setMethodCallHandler { [weak self] (call, result) in
            guard let self = self else { return }
            let args = call.arguments as? [String: Any]

            switch call.method {
            case "startScan":
                self.blueInstance.startScan(result: result)
            case "stopScan":
                self.blueInstance.stopScan(result: result)
            case "connectToGlasses":
                if let deviceName = args?["deviceName"] as? String {
                    self.blueInstance.connectToDevice(deviceName: deviceName, result: result)
                } else {
                    result(FlutterError(code: "InvalidArguments", message: "Invalid arguments", details: nil))
                }
            case "disconnectFromGlasses":
                self.blueInstance.disconnectFromGlasses(result: result)
            case "send":
                if let params = args {
                    self.blueInstance.sendData(params: params)
                }
                result(nil)
            case "startEvenAI":
                let lang = (args?["lang"] as? String) ?? "RU"
                SpeechStreamRecognizer.shared.startRecognition(identifier: lang)
                result(nil)
            case "stopEvenAI":
                SpeechStreamRecognizer.shared.stopRecognition()
                result(nil)
            case "prefsGet":
                let key = (args?["key"] as? String) ?? ""
                result(UserDefaults.standard.string(forKey: key))
            case "prefsSet":
                let key = (args?["key"] as? String) ?? ""
                if let value = args?["value"] as? String {
                    UserDefaults.standard.set(value, forKey: key)
                } else {
                    UserDefaults.standard.removeObject(forKey: key)
                }
                result(true)
            case "keychainGet":
                let key = (args?["key"] as? String) ?? ""
                result(KeychainStore.get(key))
            case "keychainSet":
                let key = (args?["key"] as? String) ?? ""
                let value = args?["value"] as? String
                result(KeychainStore.set(key, value))
            default:
                result(FlutterMethodNotImplemented)
            }
        }

        let scheduleEvent = FlutterEventChannel(name: "eventBleReceive", binaryMessenger: messenger)
        scheduleEvent.setStreamHandler(self)

        let eventSpeechRecognizeEvent = FlutterEventChannel(name: "eventSpeechRecognize", binaryMessenger: messenger)
        eventSpeechRecognizeEvent.setStreamHandler(self)

        return super.application(application, didFinishLaunchingWithOptions: launchOptions)
    }
}

// MARK: - FlutterStreamHandler
extension AppDelegate : FlutterStreamHandler {
    func onListen(withArguments arguments: Any?, eventSink events: @escaping FlutterEventSink) -> FlutterError? {
        if (arguments as? String == "eventBleReceive") {
            self.blueInstance.blueInfoSink = events
        } else if (arguments as? String == "eventSpeechRecognize") {
            BluetoothManager.shared.blueSpeechSink = events
        }
        return nil
    }

    func onCancel(withArguments arguments: Any?) -> FlutterError? {
        return nil
    }
}

// MARK: - Keychain (the OpenAI key never goes to UserDefaults or the network except api.openai.com)
enum KeychainStore {
    private static let service = "g1gpt"

    static func get(_ key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func set(_ key: String, _ value: String?) -> Bool {
        let base: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(base as CFDictionary)
        guard let value = value, !value.isEmpty, let data = value.data(using: .utf8) else { return true }
        var add = base
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        return SecItemAdd(add as CFDictionary, nil) == errSecSuccess
    }
}
