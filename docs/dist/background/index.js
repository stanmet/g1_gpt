(() => {
  var __create = Object.create;
  var __getProtoOf = Object.getPrototypeOf;
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  function __accessProp(key) {
    return this[key];
  }
  var __toESMCache_node;
  var __toESMCache_esm;
  var __toESM = (mod, isNodeMode, target) => {
    var canCache = mod != null && typeof mod === "object";
    if (canCache) {
      var cache = isNodeMode ? __toESMCache_node ??= new WeakMap : __toESMCache_esm ??= new WeakMap;
      var cached = cache.get(mod);
      if (cached)
        return cached;
    }
    target = mod != null ? __create(__getProtoOf(mod)) : {};
    const to = isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
    if (mod && typeof mod === "object" || typeof mod === "function") {
      for (let key of __getOwnPropNames(mod))
        if (!__hasOwnProp.call(to, key))
          __defProp(to, key, {
            get: __accessProp.bind(mod, key),
            enumerable: true
          });
    }
    if (canCache)
      cache.set(mod, to);
    return to;
  };
  var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);

  // vendor/eventemitter3/index.js
  var require_eventemitter3 = __commonJS(function(exports, module) {
    var has = Object.prototype.hasOwnProperty;
    var prefix = "~";
    function Events() {}
    if (Object.create) {
      Events.prototype = Object.create(null);
      if (!new Events().__proto__)
        prefix = false;
    }
    function EE(fn, context, once) {
      this.fn = fn;
      this.context = context;
      this.once = once || false;
    }
    function addListener(emitter, event, fn, context, once) {
      if (typeof fn !== "function") {
        throw new TypeError("The listener must be a function");
      }
      var listener = new EE(fn, context || emitter, once), evt = prefix ? prefix + event : event;
      if (!emitter._events[evt])
        emitter._events[evt] = listener, emitter._eventsCount++;
      else if (!emitter._events[evt].fn)
        emitter._events[evt].push(listener);
      else
        emitter._events[evt] = [emitter._events[evt], listener];
      return emitter;
    }
    function clearEvent(emitter, evt) {
      if (--emitter._eventsCount === 0)
        emitter._events = new Events;
      else
        delete emitter._events[evt];
    }
    function EventEmitter() {
      this._events = new Events;
      this._eventsCount = 0;
    }
    EventEmitter.prototype.eventNames = function eventNames() {
      var names = [], events, name;
      if (this._eventsCount === 0)
        return names;
      for (name in events = this._events) {
        if (has.call(events, name))
          names.push(prefix ? name.slice(1) : name);
      }
      if (Object.getOwnPropertySymbols) {
        return names.concat(Object.getOwnPropertySymbols(events));
      }
      return names;
    };
    EventEmitter.prototype.listeners = function listeners(event) {
      var evt = prefix ? prefix + event : event, handlers = this._events[evt];
      if (!handlers)
        return [];
      if (handlers.fn)
        return [handlers.fn];
      for (var i = 0, l = handlers.length, ee = new Array(l);i < l; i++) {
        ee[i] = handlers[i].fn;
      }
      return ee;
    };
    EventEmitter.prototype.listenerCount = function listenerCount(event) {
      var evt = prefix ? prefix + event : event, listeners = this._events[evt];
      if (!listeners)
        return 0;
      if (listeners.fn)
        return 1;
      return listeners.length;
    };
    EventEmitter.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
      var evt = prefix ? prefix + event : event;
      if (!this._events[evt])
        return false;
      var listeners = this._events[evt], len = arguments.length, args, i;
      if (listeners.fn) {
        if (listeners.once)
          this.removeListener(event, listeners.fn, undefined, true);
        switch (len) {
          case 1:
            return listeners.fn.call(listeners.context), true;
          case 2:
            return listeners.fn.call(listeners.context, a1), true;
          case 3:
            return listeners.fn.call(listeners.context, a1, a2), true;
          case 4:
            return listeners.fn.call(listeners.context, a1, a2, a3), true;
          case 5:
            return listeners.fn.call(listeners.context, a1, a2, a3, a4), true;
          case 6:
            return listeners.fn.call(listeners.context, a1, a2, a3, a4, a5), true;
        }
        for (i = 1, args = new Array(len - 1);i < len; i++) {
          args[i - 1] = arguments[i];
        }
        listeners.fn.apply(listeners.context, args);
      } else {
        var length = listeners.length, j;
        for (i = 0;i < length; i++) {
          if (listeners[i].once)
            this.removeListener(event, listeners[i].fn, undefined, true);
          switch (len) {
            case 1:
              listeners[i].fn.call(listeners[i].context);
              break;
            case 2:
              listeners[i].fn.call(listeners[i].context, a1);
              break;
            case 3:
              listeners[i].fn.call(listeners[i].context, a1, a2);
              break;
            case 4:
              listeners[i].fn.call(listeners[i].context, a1, a2, a3);
              break;
            default:
              if (!args)
                for (j = 1, args = new Array(len - 1);j < len; j++) {
                  args[j - 1] = arguments[j];
                }
              listeners[i].fn.apply(listeners[i].context, args);
          }
        }
      }
      return true;
    };
    EventEmitter.prototype.on = function on(event, fn, context) {
      return addListener(this, event, fn, context, false);
    };
    EventEmitter.prototype.once = function once(event, fn, context) {
      return addListener(this, event, fn, context, true);
    };
    EventEmitter.prototype.removeListener = function removeListener(event, fn, context, once) {
      var evt = prefix ? prefix + event : event;
      if (!this._events[evt])
        return this;
      if (!fn) {
        clearEvent(this, evt);
        return this;
      }
      var listeners = this._events[evt];
      if (listeners.fn) {
        if (listeners.fn === fn && (!once || listeners.once) && (!context || listeners.context === context)) {
          clearEvent(this, evt);
        }
      } else {
        for (var i = 0, events = [], length = listeners.length;i < length; i++) {
          if (listeners[i].fn !== fn || once && !listeners[i].once || context && listeners[i].context !== context) {
            events.push(listeners[i]);
          }
        }
        if (events.length)
          this._events[evt] = events.length === 1 ? events[0] : events;
        else
          clearEvent(this, evt);
      }
      return this;
    };
    EventEmitter.prototype.removeAllListeners = function removeAllListeners(event) {
      var evt;
      if (event) {
        evt = prefix ? prefix + event : event;
        if (this._events[evt])
          clearEvent(this, evt);
      } else {
        this._events = new Events;
        this._eventsCount = 0;
      }
      return this;
    };
    EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
    EventEmitter.prototype.addListener = EventEmitter.prototype.on;
    EventEmitter.prefixed = prefix;
    EventEmitter.EventEmitter = EventEmitter;
    if (typeof module !== "undefined") {
      module.exports = EventEmitter;
    }
  });

  // vendor/eventemitter3/index.mjs
  var import__ = __toESM(require_eventemitter3(), 1);

  // vendor/mentra-miniapp/src/envelope.ts
  function serializeEnvelope(envelope) {
    return JSON.stringify(envelope);
  }
  function parseEnvelope(raw) {
    if (typeof raw !== "string")
      return null;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
    if (typeof parsed !== "object" || parsed === null)
      return null;
    const obj = parsed;
    if (typeof obj.payload !== "object" || obj.payload === null)
      return null;
    if (obj.requestId !== undefined && typeof obj.requestId !== "string")
      return null;
    return {
      payload: obj.payload,
      requestId: obj.requestId
    };
  }
  function makeRequestId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }

  // vendor/mentra-miniapp/src/globals.ts
  function getMentraOSGlobals() {
    if (typeof window === "undefined")
      return {};
    return window.MentraOS ?? {};
  }

  // vendor/mentra-miniapp/src/transport/dispatch.ts
  class DispatchTransport {
    messageHandler = null;
    disconnectHandler = null;
    open_ = false;
    static isAvailable() {
      return typeof globalThis.__dispatch === "function";
    }
    async open() {
      if (!DispatchTransport.isAvailable()) {
        throw new Error("DispatchTransport: __dispatch is not installed on globalThis");
      }
      const g = globalThis;
      g.__mentraDeliverBridgeRaw = (raw) => {
        if (this.messageHandler)
          this.messageHandler(raw);
      };
      this.open_ = true;
    }
    send(raw) {
      if (!this.open_) {
        throw new Error("DispatchTransport: send() before open()");
      }
      const g = globalThis;
      if (typeof g.__dispatch !== "function") {
        this.open_ = false;
        this.disconnectHandler?.("DispatchTransport: __dispatch disappeared");
        return;
      }
      try {
        g.__dispatch("__bridge", "send", JSON.stringify([raw]));
      } catch (e) {
        this.disconnectHandler?.(`DispatchTransport: __dispatch threw: ${String(e)}`);
      }
    }
    onMessage(handler) {
      this.messageHandler = handler;
    }
    onDisconnect(handler) {
      this.disconnectHandler = handler;
    }
    close() {
      this.open_ = false;
      const g = globalThis;
      if (g.__mentraDeliverBridgeRaw) {
        delete g.__mentraDeliverBridgeRaw;
      }
    }
    isOpen() {
      return this.open_;
    }
  }

  // vendor/mentra-miniapp/src/transport/local-socket.ts
  var DEFAULT_URL = "ws://127.0.0.1:8765";

  class LocalSocketTransport {
    url;
    ws = null;
    messageHandler = null;
    disconnectHandler = null;
    constructor(options = {}) {
      this.url = options.url ?? DEFAULT_URL;
    }
    async open() {
      if (this.ws && this.ws.readyState === WebSocket.OPEN)
        return;
      if (typeof WebSocket === "undefined") {
        throw new Error("LocalSocketTransport: browser WebSocket global not available");
      }
      await new Promise((resolve, reject) => {
        const ws = new WebSocket(this.url);
        let settled = false;
        const settle = (fn) => {
          if (settled)
            return;
          settled = true;
          fn();
        };
        ws.onopen = () => {
          this.ws = ws;
          settle(() => resolve());
        };
        ws.onerror = (ev) => {
          settle(() => reject(new Error(`LocalSocketTransport: failed to connect to ${this.url}: ${String(ev)}`)));
        };
        ws.onmessage = (ev) => {
          const data = ev.data;
          if (typeof data === "string")
            this.messageHandler?.(data);
        };
        ws.onclose = (ev) => {
          if (this.ws === ws)
            this.ws = null;
          this.disconnectHandler?.(`closed: ${ev.code} ${ev.reason}`);
        };
      });
    }
    send(raw) {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        throw new Error("LocalSocketTransport: not connected");
      }
      this.ws.send(raw);
    }
    onMessage(handler) {
      this.messageHandler = handler;
    }
    onDisconnect(handler) {
      this.disconnectHandler = handler;
    }
    close() {
      if (!this.ws)
        return;
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    isOpen() {
      return !!this.ws && this.ws.readyState === WebSocket.OPEN;
    }
  }

  // vendor/mentra-miniapp/src/transport/mock.ts
  var LOG_PREFIX = "[mock-transport]";
  function isMockExplicitlyRequested() {
    if (typeof window === "undefined")
      return false;
    try {
      if (typeof window.location !== "undefined" && window.location.search) {
        const params = new URLSearchParams(window.location.search);
        if (params.get("mentra") === "mock")
          return true;
      }
    } catch {}
    try {
      if (typeof localStorage !== "undefined" && localStorage.getItem("MENTRA_MOCK") === "1") {
        return true;
      }
    } catch {}
    return false;
  }

  class MockTransport {
    messageHandler = null;
    disconnectHandler = null;
    open_ = false;
    userId;
    authToken;
    packageName;
    silent;
    configuration;
    constructor(options = {}) {
      this.userId = options.userId ?? "mock-user";
      this.authToken = options.authToken ?? "mock-miniapp-token";
      this.packageName = options.packageName ?? null;
      this.silent = options.silent === true;
      this.configuration = { ...options.configuration ?? {} };
    }
    async open() {
      if (this.open_)
        return;
      this.open_ = true;
      this.log("transport opened (no real host; synthetic responses only)");
    }
    send(raw) {
      if (!this.open_) {
        throw new Error("MockTransport: send() before open()");
      }
      const envelope = parseEnvelope(raw);
      if (!envelope) {
        this.log("dropped unparseable envelope:", raw.slice(0, 200));
        return;
      }
      const payload = envelope.payload;
      const type = payload?.type;
      this.log(`recv ${type ?? "<unknown>"}${envelope.requestId ? ` (rid=${envelope.requestId})` : ""}`);
      switch (type) {
        case "miniapp_connect" /* CONNECT */:
          this.deliverConnectAck(payload);
          return;
        case "miniapp_ping" /* PING */:
          return;
        case "miniapp_subscribe" /* SUBSCRIBE */:
          return;
        default:
          if (envelope.requestId) {
            this.deliverSyntheticResult(envelope.requestId, type ?? "<unknown>", payload);
          }
          return;
      }
    }
    onMessage(handler) {
      this.messageHandler = handler;
    }
    onDisconnect(handler) {
      this.disconnectHandler = handler;
    }
    close() {
      if (!this.open_)
        return;
      this.open_ = false;
      this.disconnectHandler?.("MockTransport.close()");
    }
    isOpen() {
      return this.open_;
    }
    deliverConnectAck(connectPayload) {
      const incomingPackage = connectPayload.packageName ?? this.packageName ?? "com.mock.app";
      const ackPayload = {
        type: "miniapp_connect_ack" /* CONNECT_ACK */,
        userId: this.userId,
        packageName: incomingPackage,
        capabilities: null,
        visibility: "foreground",
        colorScheme: "light",
        configuration: { ...this.configuration },
        auth: {
          mentraUserId: this.userId,
          oemId: "mock",
          token: this.authToken,
          expiresAt: Date.now() + 60 * 60 * 1000
        }
      };
      const envelope = { payload: ackPayload };
      this.log(`-> CONNECT_ACK userId=${this.userId} pkg=${incomingPackage}`);
      queueMicrotask(() => this.messageHandler?.(serializeEnvelope(envelope)));
    }
    deliverSyntheticResult(requestId, requestType, requestPayload) {
      const data = syntheticDataFor(requestId, requestType, requestPayload);
      const responsePayload = {
        type: "miniapp_request_result" /* REQUEST_RESULT */,
        ok: true,
        data
      };
      const envelope = { payload: responsePayload, requestId };
      this.log(`-> REQUEST_RESULT (rid=${requestId}) synthetic ${requestType}`);
      queueMicrotask(() => this.messageHandler?.(serializeEnvelope(envelope)));
    }
    log(...args) {
      if (this.silent)
        return;
      console.log(LOG_PREFIX, ...args);
    }
  }
  function syntheticDataFor(requestId, requestType, requestPayload) {
    switch (requestType) {
      case "miniapp_camera_fov" /* CAMERA_FOV */: {
        const presetFov = requestPayload.preset === "narrow" ? 82 : requestPayload.preset === "wide" ? 118 : requestPayload.preset === "standard" ? 102 : undefined;
        const fov = typeof requestPayload.fov === "number" ? requestPayload.fov : presetFov ?? 102;
        const roi = requestPayload.roiPosition;
        const roiPosition = roi === "bottom" ? "bottom" : roi === "top" ? "top" : "center";
        return {
          requestId,
          fov,
          roiPosition,
          timestamp: Date.now()
        };
      }
      case "miniapp_photo" /* PHOTO */:
        return {
          photoUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=",
          requestId: "mock-photo"
        };
      case "miniapp_rgb_led" /* RGB_LED */:
        return { type: "rgb_led_control_response", state: "success", requestId };
      case "miniapp_location_poll" /* LOCATION_POLL */:
        return { lat: 37.7956, lng: -122.3933, accuracy: 0, timestamp: Date.now() };
      case "miniapp_calendar_list_events" /* CALENDAR_LIST_EVENTS */:
        return { events: [], truncated: false };
      case "miniapp_storage_get" /* STORAGE_GET */:
        return { value: null };
      case "miniapp_storage_list" /* STORAGE_LIST */:
        return { keys: [] };
      case "miniapp_speak" /* SPEAK */:
        return { audioUrl: null, durationMs: 0 };
      case "miniapp_share" /* SHARE */:
      case "miniapp_open_url" /* OPEN_URL */:
      case "miniapp_copy_clipboard" /* COPY_CLIPBOARD */:
      case "miniapp_download" /* DOWNLOAD */:
      case "miniapp_request_wifi_setup" /* REQUEST_WIFI_SETUP */:
      case "miniapp_set_wifi_adb_state" /* SET_WIFI_ADB_STATE */:
        return { ok: true };
      case "miniapp_scan_qr" /* SCAN_QR */:
        return { cancelled: true };
      default:
        return null;
    }
  }

  // vendor/mentra-miniapp/src/transport/postmessage.ts
  class PostMessageTransport {
    messageHandler = null;
    disconnectHandler = null;
    open_ = false;
    windowListener = null;
    async open() {
      if (this.open_)
        return;
      if (typeof window === "undefined" || !window.ReactNativeWebView) {
        throw new Error("PostMessageTransport: not running inside a React Native WebView");
      }
      this.windowListener = (ev) => {
        const data = ev.data;
        if (typeof data !== "string")
          return;
        this.messageHandler?.(data);
      };
      window.addEventListener("message", this.windowListener);
      if (typeof document !== "undefined") {
        document.addEventListener("message", this.windowListener);
      }
      window.receiveNativeMessage = (raw) => {
        this.messageHandler?.(raw);
      };
      this.open_ = true;
    }
    send(raw) {
      if (typeof window === "undefined" || !window.ReactNativeWebView) {
        throw new Error("PostMessageTransport: not running inside a React Native WebView");
      }
      window.ReactNativeWebView.postMessage(raw);
    }
    onMessage(handler) {
      this.messageHandler = handler;
    }
    onDisconnect(handler) {
      this.disconnectHandler = handler;
    }
    close() {
      if (!this.open_)
        return;
      this.open_ = false;
      if (this.windowListener) {
        window.removeEventListener("message", this.windowListener);
        if (typeof document !== "undefined") {
          document.removeEventListener("message", this.windowListener);
        }
        this.windowListener = null;
      }
      if (typeof window !== "undefined" && window.receiveNativeMessage) {
        window.receiveNativeMessage = undefined;
      }
      this.disconnectHandler?.("closed");
    }
    isOpen() {
      return this.open_;
    }
  }

  // vendor/mentra-miniapp/src/transport/auto.ts
  var LOCAL_SOCKET_OPEN_TIMEOUT_MS = 500;
  function createTransport(options = {}) {
    if (options.transport)
      return options.transport;
    if (DispatchTransport.isAvailable()) {
      return new DispatchTransport;
    }
    if (typeof window !== "undefined" && window.ReactNativeWebView) {
      return new PostMessageTransport;
    }
    if (isMockExplicitlyRequested()) {
      return new MockTransport;
    }
    if (typeof WebSocket !== "undefined") {
      const localSocketOptions = {};
      if (options.localSocketUrl)
        localSocketOptions.url = options.localSocketUrl;
      return new LocalSocketWithMockFallback(localSocketOptions);
    }
    return new MockTransport;
  }

  class LocalSocketWithMockFallback {
    options;
    active = null;
    messageHandler = null;
    disconnectHandler = null;
    constructor(options) {
      this.options = options;
    }
    async open() {
      const local = new LocalSocketTransport(this.options);
      let timedOut = false;
      const timeout = new Promise((_, reject) => {
        setTimeout(() => {
          timedOut = true;
          reject(new Error("LocalSocketTransport open timed out"));
        }, LOCAL_SOCKET_OPEN_TIMEOUT_MS);
      });
      try {
        await Promise.race([local.open(), timeout]);
        this.active = local;
      } catch {
        try {
          local.close();
        } catch {}
        const mock = new MockTransport;
        await mock.open();
        this.active = mock;
        console.log(timedOut ? "[mentra-miniapp] No phone WebSocket reachable; using MockTransport so the page can render." : "[mentra-miniapp] LocalSocketTransport failed; using MockTransport.");
      }
      if (this.messageHandler)
        this.active.onMessage(this.messageHandler);
      if (this.disconnectHandler)
        this.active.onDisconnect(this.disconnectHandler);
    }
    send(raw) {
      if (!this.active)
        throw new Error("LocalSocketWithMockFallback: send() before open()");
      this.active.send(raw);
    }
    onMessage(handler) {
      this.messageHandler = handler;
      this.active?.onMessage(handler);
    }
    onDisconnect(handler) {
      this.disconnectHandler = handler;
      this.active?.onDisconnect(handler);
    }
    close() {
      this.active?.close();
    }
    isOpen() {
      return this.active?.isOpen() === true;
    }
  }

  // vendor/mentra-cloud-protocol/src/photo-compression.ts
  var photoCompressionValues = ["none", "low", "medium", "high"];
  function parsePhotoCompression(value = "none") {
    if (typeof value === "string" && photoCompressionValues.includes(value)) {
      return value;
    }
    throw new TypeError(`Invalid photo compression ${JSON.stringify(value)}. Expected none, low, medium, or high.`);
  }

  // vendor/mentra-miniapp/src/modules/camera.ts
  class CameraModule {
    session;
    constructor(session) {
      this.session = session;
    }
    get hasPermission() {
      return this.session._hasManifestPermission("CAMERA");
    }
    async setFov(request) {
      return this.session.sendRequest({
        type: "miniapp_camera_fov" /* CAMERA_FOV */,
        ...request
      });
    }
    async takePhoto(options = {}) {
      return this.session.sendRequest({
        type: "miniapp_photo" /* PHOTO */,
        size: options.size ?? "medium",
        mode: options.mode ?? "photo",
        ...options.transferMethod !== undefined ? { transferMethod: options.transferMethod } : {},
        compress: parsePhotoCompression(options.compress),
        sound: options.sound ?? true,
        saveToGallery: options.saveToGallery ?? false,
        exposureTimeNs: options.exposureTimeNs,
        iso: options.iso,
        aeExposureDivisor: options.aeExposureDivisor,
        isoCap: options.isoCap,
        noiseReduction: options.noiseReduction,
        edgeEnhancement: options.edgeEnhancement,
        zsl: options.zsl,
        mfnr: options.mfnr,
        ispDigitalGain: options.ispDigitalGain,
        ispAnalogGain: options.ispAnalogGain
      }, options.timeoutMs != null ? { timeoutMs: options.timeoutMs } : undefined);
    }
    async warmUp(options = {}) {
      await this.session.sendRequest({
        type: "miniapp_camera_warm_up" /* CAMERA_WARM_UP */,
        size: options.size ?? "medium",
        mode: options.mode ?? "photo",
        exposureTimeNs: options.exposureTimeNs,
        durationMs: options.durationMs ?? 15000,
        zsl: options.zsl,
        mfnr: options.mfnr
      });
    }
    async startVideoRecording(options = {}) {
      return this.session.sendRequest({
        type: "miniapp_video_recording_start" /* VIDEO_RECORDING_START */,
        width: options.width,
        height: options.height,
        fps: options.fps,
        sound: options.sound ?? true,
        save: options.save ?? false
      });
    }
    async stopVideoRecording(recordingId, options = {}) {
      await this.session.sendRequest({
        type: "miniapp_video_recording_stop" /* VIDEO_RECORDING_STOP */,
        recordingId,
        uploadUrl: options.uploadUrl,
        uploadAuthToken: options.uploadAuthToken
      });
    }
  }

  // vendor/mentra-miniapp/src/modules/auth.ts
  var DEFAULT_MIN_TTL_MS = 30000;

  class AuthModule {
    session;
    constructor(session) {
      this.session = session;
    }
    get current() {
      return this.session._getAuth();
    }
    get mentraUserId() {
      return this.current?.mentraUserId ?? null;
    }
    get oemId() {
      return this.current?.oemId ?? null;
    }
    async getToken(options = {}) {
      const auth = await this.session._waitForAuth(options.minTtlMs ?? DEFAULT_MIN_TTL_MS);
      return auth.token;
    }
    async getAuthHeader(options = {}) {
      return `Bearer ${await this.getToken(options)}`;
    }
    async fetch(input, init = {}) {
      const { minTtlMs, ...requestInit } = init;
      const token = await this.getToken({ minTtlMs });
      const headers = mergeHeaders(requestInit.headers, { Authorization: `Bearer ${token}` });
      return fetch(input, { ...requestInit, headers });
    }
    onUpdate(handler) {
      return this.session.on("auth", handler);
    }
  }
  function mergeHeaders(base, next) {
    const headers = {};
    if (Array.isArray(base)) {
      for (const [key, value] of base) {
        headers[key] = value;
      }
    } else if (typeof Headers !== "undefined" && base instanceof Headers) {
      base.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (base && typeof base === "object") {
      for (const [key, value] of Object.entries(base)) {
        if (typeof value === "string")
          headers[key] = value;
      }
    }
    return { ...headers, ...next };
  }

  // vendor/mentra-miniapp/src/modules/cloud.ts
  var CLOUD_STATUS_STREAM = "_cloud_status";
  var DEFAULT_STATUS = {
    status: "disconnected",
    audioTransport: "none"
  };
  function normalizeCloudStatus(data) {
    if (!data || typeof data !== "object")
      return null;
    const raw = data;
    const status = raw.status;
    const audioTransport = raw.audioTransport;
    if (status !== "connected" && status !== "connecting" && status !== "reconnecting" && status !== "disconnected") {
      return null;
    }
    if (audioTransport !== "udp" && audioTransport !== "ws" && audioTransport !== "offline" && audioTransport !== "none") {
      return null;
    }
    return { status, audioTransport };
  }

  class CloudModule {
    session;
    emitter = new import__.default;
    current = { ...DEFAULT_STATUS };
    constructor(session) {
      this.session = session;
      this.session._subscribe(CLOUD_STATUS_STREAM, (data) => {
        const next = normalizeCloudStatus(data);
        if (!next)
          return;
        if (next.status === this.current.status && next.audioTransport === this.current.audioTransport)
          return;
        this.current = next;
        this.emitter.emit("status", { ...this.current });
      });
    }
    get status() {
      return { ...this.current };
    }
    get connected() {
      return this.current.status === "connected";
    }
    isConnected() {
      return this.connected;
    }
    onStatusChanged(handler) {
      handler({ ...this.current });
      this.emitter.on("status", handler);
      return () => {
        this.emitter.off("status", handler);
      };
    }
  }

  // vendor/mentra-miniapp/src/modules/configuration.ts
  class MiniappConfigurationError extends Error {
    key;
    constructor(key) {
      super(`Required miniapp configuration is missing: ${key}`);
      this.key = key;
      this.name = "MiniappConfigurationError";
    }
  }

  class ConfigurationModule {
    session;
    constructor(session) {
      this.session = session;
    }
    async get(key) {
      await this.session.waitForReady();
      const configuration = this.session._getConfiguration();
      return Object.prototype.hasOwnProperty.call(configuration, key) ? configuration[key] : undefined;
    }
    async require(key) {
      const value = await this.get(key);
      if (value === undefined)
        throw new MiniappConfigurationError(key);
      return value;
    }
    async getAll() {
      await this.session.waitForReady();
      return Object.assign(Object.create(null), this.session._getConfiguration());
    }
  }

  // vendor/mentra-miniapp/src/modules/dashboard.ts
  class DashboardAPI {
    session;
    warned = false;
    constructor(session) {
      this.session = session;
    }
    setContent(mode, content) {
      if (!this.warned) {
        console.warn("[@mentra/miniapp] dashboard.setContent() is deferred in v1.");
        this.warned = true;
      }
      this.session.sendOneShot({
        type: "miniapp_dashboard_content_update" /* DASHBOARD_CONTENT_UPDATE */,
        mode,
        content
      });
    }
  }

  // vendor/mentra-miniapp/src/modules/display.ts
  class DisplayManager {
    session;
    constructor(session) {
      this.session = session;
    }
    render(elements, options = {}) {
      return this.session.sendRequest({
        type: "miniapp_render" /* RENDER */,
        view: options.view ?? "main",
        elements,
        durationMs: options.durationMs,
        includeTextLayout: options.includeTextLayout,
        ifDisplayToken: options.ifDisplayToken
      }).catch((err) => ({
        status: "blocked",
        reason: typeof err === "object" && err !== null && "message" in err ? String(err.message) : String(err)
      }));
    }
  }

  // vendor/mentra-miniapp/src/modules/events.ts
  class EventManager {
    session;
    emitter = new import__.default;
    refCounts = new Map;
    forceLocalRefCounts = new Map;
    constructor(session) {
      this.session = session;
    }
    subscribe(stream, handler, options = {}) {
      const isInternal = stream.startsWith("_");
      const forceLocal = options.forceLocal === true && stream.startsWith(`${"transcription" /* TRANSCRIPTION */}:`);
      const listener = (data, route) => {
        if (stream.startsWith(`${"transcription" /* TRANSCRIPTION */}:`)) {
          if (forceLocal ? route !== "forceLocal" && route !== "all" : route === "forceLocal")
            return;
        }
        handler(data);
      };
      this.emitter.on(stream, listener);
      if (!isInternal) {
        const before = this.refCounts.get(stream) ?? 0;
        this.refCounts.set(stream, before + 1);
        const forceLocalBefore = this.forceLocalRefCounts.get(stream) ?? 0;
        const defaultBefore = before - forceLocalBefore;
        if (forceLocal)
          this.forceLocalRefCounts.set(stream, forceLocalBefore + 1);
        if (before === 0 || forceLocal && forceLocalBefore === 0 || !forceLocal && defaultBefore === 0) {
          this.sendSubscriptionUpdate();
        }
      }
      return () => {
        this.emitter.off(stream, listener);
        if (isInternal)
          return;
        const current = this.refCounts.get(stream) ?? 0;
        const forceLocalCurrent = this.forceLocalRefCounts.get(stream) ?? 0;
        let subscriptionChanged = current <= 1;
        if (current <= 1) {
          this.refCounts.delete(stream);
        } else {
          this.refCounts.set(stream, current - 1);
        }
        if (forceLocal) {
          if (forceLocalCurrent <= 1) {
            this.forceLocalRefCounts.delete(stream);
            subscriptionChanged = true;
          } else {
            this.forceLocalRefCounts.set(stream, forceLocalCurrent - 1);
          }
        } else if (current - forceLocalCurrent <= 1) {
          subscriptionChanged = true;
        }
        if (subscriptionChanged)
          this.sendSubscriptionUpdate();
      };
    }
    unsubscribeAll() {
      this.emitter.removeAllListeners();
      this.refCounts.clear();
      this.forceLocalRefCounts.clear();
      this.sendSubscriptionUpdate();
    }
    _forwardEvent(stream, data, transcriptionRoute) {
      this.emitter.emit(stream, data, transcriptionRoute);
      if (stream.startsWith("transcription:") && stream !== "transcription:auto") {
        this.emitter.emit("transcription:auto", data, transcriptionRoute);
      } else if (stream.startsWith("translation:")) {
        const parts = stream.split(":");
        const patterns = new Set(["translation:auto"]);
        if (parts.length === 3) {
          const [, source, target] = parts;
          patterns.add("translation:*:*");
          patterns.add(`translation:*:${target}`);
          patterns.add(`translation:${source}:*`);
        }
        patterns.delete(stream);
        for (const pattern of patterns) {
          this.emitter.emit(pattern, data);
        }
      }
    }
    sendSubscriptionUpdate() {
      const subscriptions = Array.from(this.refCounts.keys()).map((stream) => {
        if (stream === "location_update" /* LOCATION_UPDATE */)
          return { stream: "location_stream", rate: "realtime" };
        const forceLocalRefs = this.forceLocalRefCounts.get(stream) ?? 0;
        if (forceLocalRefs === 0)
          return stream;
        const totalRefs = this.refCounts.get(stream) ?? 0;
        return {
          stream,
          forceLocal: true,
          ...totalRefs > forceLocalRefs ? { includeCloud: true } : {}
        };
      });
      this.session.sendOneShot({
        type: "miniapp_subscribe" /* SUBSCRIBE */,
        subscriptions
      });
    }
  }

  // vendor/mentra-miniapp/src/modules/glasses.ts
  class GlassesModule {
    session;
    constructor(session) {
      this.session = session;
    }
    onBattery(handler) {
      return this.session._subscribe("glasses_battery" /* GLASSES_BATTERY */, handler);
    }
    onConnection(handler) {
      return this.session._subscribe("glasses_connection" /* GLASSES_CONNECTION */, handler);
    }
    onWifi(handler) {
      return this.session._subscribe("glasses_wifi" /* GLASSES_WIFI */, handler);
    }
    async requestWifiSetup(reason) {
      await this.session.sendRequest({
        type: "miniapp_request_wifi_setup" /* REQUEST_WIFI_SETUP */,
        reason
      });
    }
    async setWifiAdbState(enabled) {
      await this.session.sendRequest({
        type: "miniapp_set_wifi_adb_state" /* SET_WIFI_ADB_STATE */,
        enabled
      });
    }
  }

  // vendor/mentra-miniapp/src/modules/heading.ts
  class HeadingModule {
    session;
    constructor(session) {
      this.session = session;
    }
    get hasPermission() {
      return this.session._hasManifestPermission("LOCATION");
    }
    onUpdate(handler) {
      return this.session._subscribe("heading_update" /* HEADING_UPDATE */, handler);
    }
  }

  // vendor/mentra-miniapp/src/modules/imu.ts
  class ImuModule {
    session;
    constructor(session) {
      this.session = session;
    }
    onHeadPosition(handler) {
      return this.session._subscribe("head_position" /* HEAD_POSITION */, handler);
    }
    onAccel(handler) {
      return this.session._subscribe("accel_data" /* ACCEL_DATA */, handler);
    }
    setEnabled(enabled) {
      return this.session.sendRequest({
        type: "miniapp_imu_set_enabled" /* IMU_SET_ENABLED */,
        enabled
      });
    }
  }

  // vendor/mentra-miniapp/src/modules/input.ts
  class InputModule {
    session;
    constructor(session) {
      this.session = session;
    }
    onButtonPress(handler) {
      return this.session._subscribe("button_press" /* BUTTON_PRESS */, handler);
    }
    onTouch(gestureOrHandler, maybeHandler) {
      if (typeof gestureOrHandler === "function") {
        return this.session._subscribe("touch_event" /* TOUCH_EVENT */, gestureOrHandler);
      }
      const handler = maybeHandler;
      const gestures = Array.isArray(gestureOrHandler) ? gestureOrHandler : [gestureOrHandler];
      if (gestures.length === 0)
        return () => {};
      const unsubs = [];
      for (const g of gestures) {
        unsubs.push(this.session._subscribe(`${"touch_event" /* TOUCH_EVENT */}:${g}`, handler));
      }
      return () => {
        for (const u of unsubs) {
          try {
            u();
          } catch {}
        }
      };
    }
  }

  // vendor/mentra-miniapp/src/modules/led.ts
  class LedModule {
    session;
    constructor(session) {
      this.session = session;
    }
    async turnOn(options = {}) {
      return this.session.sendRequest({
        type: "miniapp_rgb_led" /* RGB_LED */,
        action: "on",
        color: options.color ?? "red",
        ontime: options.ontime ?? 1000,
        offtime: options.offtime ?? 0,
        count: options.count ?? 1
      });
    }
    async turnOff() {
      return this.session.sendRequest({
        type: "miniapp_rgb_led" /* RGB_LED */,
        action: "off"
      });
    }
    async blink(color, ontime, offtime, count) {
      return this.turnOn({ color, ontime, offtime, count });
    }
    async solid(color, duration) {
      return this.turnOn({ color, ontime: duration, offtime: 0, count: 1 });
    }
  }

  // vendor/mentra-miniapp/src/modules/location.ts
  class LocationModule {
    session;
    constructor(session) {
      this.session = session;
    }
    get hasPermission() {
      return this.session._hasManifestPermission("LOCATION");
    }
    onUpdate(handler) {
      return this.session._subscribe("location_update" /* LOCATION_UPDATE */, handler);
    }
    getOnce() {
      return this.session.sendRequest({
        type: "miniapp_location_poll" /* LOCATION_POLL */
      });
    }
  }

  // vendor/mentra-miniapp/src/modules/mic.ts
  class MicModule {
    session;
    unsubs = new Set;
    constructor(session) {
      this.session = session;
    }
    onVoiceActivity(handler) {
      return this.track(this.session._subscribe("vad" /* VAD */, handler));
    }
    onAudioChunk(handler) {
      return this.track(this.session._subscribe("audio_chunk" /* AUDIO_CHUNK */, handler));
    }
    setVoiceActivityDetectionEnabled(enabled) {
      return this.session.sendRequest({
        type: "miniapp_mic_set_vad_enabled" /* MIC_SET_VAD_ENABLED */,
        enabled
      });
    }
    setLoudnessGateEnabled(enabled) {
      return this.session.sendRequest({
        type: "miniapp_mic_set_loudness_gate_enabled" /* MIC_SET_LOUDNESS_GATE_ENABLED */,
        enabled
      });
    }
    async acquire(options) {
      const result = await this.session.sendRequest({
        type: "miniapp_mic_acquire" /* MIC_ACQUIRE */,
        source: options.source,
        useCase: options.useCase
      });
      if (typeof result?.sessionId !== "number") {
        throw new Error("This version of the Mentra App does not support microphone sessions");
      }
      const { sessionId } = result;
      let released = false;
      return {
        sessionId,
        release: async () => {
          if (released)
            return;
          released = true;
          await this.session.sendRequest({
            type: "miniapp_mic_release" /* MIC_RELEASE */,
            sessionId
          });
        }
      };
    }
    stop() {
      for (const u of this.unsubs) {
        try {
          u();
        } catch {}
      }
      this.unsubs.clear();
    }
    get hasPermission() {
      return this.session._hasManifestPermission("MICROPHONE");
    }
    track(unsub) {
      this.unsubs.add(unsub);
      return () => {
        this.unsubs.delete(unsub);
        unsub();
      };
    }
  }

  // vendor/mentra-miniapp/src/modules/pivots/geometry.ts
  var TURN_THRESHOLD_DEG = 15;
  var SAME_DIR_MERGE_M = 25;
  var RDP_EPSILON_M = 5;
  var MIN_BEND_PER_POINT_DEG = 10;
  var STRAIGHT_SEGMENT_BREAK_M = 1;
  var INTERSECTION_CLUSTER_M = 30;
  function haversineMeters(a, b) {
    const R = 6371000;
    const toRad = (d) => d * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function bearingDeg(a, b) {
    const toRad = (d) => d * Math.PI / 180;
    const toDeg = (r) => r * 180 / Math.PI;
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const dLng = toRad(b.lng - a.lng);
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }
  function signedAngleDiff(target, actual) {
    return (target - actual + 540) % 360 - 180;
  }
  function rdpSimplify(points, epsilonMeters) {
    if (points.length < 3)
      return points.map((_, i) => i);
    const keep = new Array(points.length).fill(false);
    keep[0] = true;
    keep[points.length - 1] = true;
    const stack = [[0, points.length - 1]];
    while (stack.length) {
      const [lo, hi] = stack.pop();
      let maxDist = 0;
      let maxIdx = -1;
      for (let i = lo + 1;i < hi; i++) {
        const d = perpDistMeters(points[i], points[lo], points[hi]);
        if (d > maxDist) {
          maxDist = d;
          maxIdx = i;
        }
      }
      if (maxIdx !== -1 && maxDist > epsilonMeters) {
        keep[maxIdx] = true;
        stack.push([lo, maxIdx], [maxIdx, hi]);
      }
    }
    const out = [];
    for (let i = 0;i < keep.length; i++)
      if (keep[i])
        out.push(i);
    return out;
  }
  function perpDistMeters(p, a, b) {
    const mPerDegLat = 111320;
    const mPerDegLng = 111320 * Math.cos(a.lat * Math.PI / 180);
    const bx = (b.lng - a.lng) * mPerDegLng;
    const by = (b.lat - a.lat) * mPerDegLat;
    const px = (p.lng - a.lng) * mPerDegLng;
    const py = (p.lat - a.lat) * mPerDegLat;
    const dx = bx;
    const dy = by;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0)
      return Math.sqrt(px * px + py * py);
    return Math.abs(dx * -py - -px * dy) / len;
  }
  function extractPivots(rawPoints) {
    if (rawPoints.length < 3)
      return [];
    const keptIdx = rdpSimplify(rawPoints, RDP_EPSILON_M);
    const simplified = keptIdx.map((i) => rawPoints[i]);
    if (simplified.length < 3)
      return [];
    const deltas = [];
    for (let i = 1;i < simplified.length - 1; i++) {
      const inBearing = bearingDeg(simplified[i - 1], simplified[i]);
      const outBearing = bearingDeg(simplified[i], simplified[i + 1]);
      deltas.push(signedAngleDiff(outBearing, inBearing));
    }
    const candidates = [];
    let runStart = -1;
    let runSum = 0;
    let runSign = 0;
    const flushRun = (endExclusive) => {
      if (runStart === -1)
        return;
      if (Math.abs(runSum) >= TURN_THRESHOLD_DEG) {
        let bestIdx = runStart;
        let bestAbs = 0;
        for (let k = runStart;k < endExclusive; k++) {
          const a = Math.abs(deltas[k]);
          if (a > bestAbs) {
            bestAbs = a;
            bestIdx = k;
          }
        }
        const simplifiedIdx = bestIdx + 1;
        candidates.push({
          lat: simplified[simplifiedIdx].lat,
          lng: simplified[simplifiedIdx].lng,
          direction: runSum > 0 ? "right" : "left",
          simplifiedRouteIndex: simplifiedIdx,
          rawRouteIndex: keptIdx[simplifiedIdx],
          headingDelta: runSum
        });
      }
      runStart = -1;
      runSum = 0;
      runSign = 0;
    };
    let metersSinceLastBend = 0;
    for (let k = 0;k < deltas.length; k++) {
      const d = deltas[k];
      const sign = d > 0 ? 1 : d < 0 ? -1 : 0;
      const segLen = haversineMeters(simplified[k + 1], simplified[k + 2]);
      if (sign === 0 || Math.abs(d) < MIN_BEND_PER_POINT_DEG) {
        if (runStart !== -1) {
          if (sign === runSign || sign === 0)
            runSum += d;
          metersSinceLastBend += segLen;
          if (metersSinceLastBend >= STRAIGHT_SEGMENT_BREAK_M) {
            flushRun(k + 1);
          }
        }
        continue;
      }
      if (runStart === -1) {
        runStart = k;
        runSum = d;
        runSign = sign;
        metersSinceLastBend = segLen;
      } else if (sign === runSign) {
        if (metersSinceLastBend >= STRAIGHT_SEGMENT_BREAK_M) {
          flushRun(k);
          runStart = k;
          runSum = d;
          runSign = sign;
        } else {
          runSum += d;
        }
        metersSinceLastBend = segLen;
      } else {
        flushRun(k);
        runStart = k;
        runSum = d;
        runSign = sign;
        metersSinceLastBend = segLen;
      }
    }
    flushRun(deltas.length);
    const merged = [];
    for (const p of candidates) {
      const last = merged[merged.length - 1];
      if (last && last.direction === p.direction && haversineMeters({ lat: last.lat, lng: last.lng }, { lat: p.lat, lng: p.lng }) < SAME_DIR_MERGE_M) {
        if (Math.abs(p.headingDelta) > Math.abs(last.headingDelta)) {
          merged[merged.length - 1] = p;
        }
        continue;
      }
      merged.push(p);
    }
    const clustered = [];
    for (const p of merged) {
      const last = clustered[clustered.length - 1];
      if (last && haversineMeters({ lat: last.lat, lng: last.lng }, { lat: p.lat, lng: p.lng }) < INTERSECTION_CLUSTER_M) {
        const netDelta = last.headingDelta + p.headingDelta;
        const anchor = Math.abs(p.headingDelta) > Math.abs(last.headingDelta) ? p : last;
        clustered[clustered.length - 1] = {
          ...anchor,
          direction: netDelta > 0 ? "right" : "left",
          headingDelta: netDelta
        };
        continue;
      }
      clustered.push(p);
    }
    return clustered.filter((p) => Math.abs(p.headingDelta) >= TURN_THRESHOLD_DEG);
  }
  function cumulativeDistances(points) {
    const out = new Array(points.length);
    out[0] = 0;
    for (let i = 1;i < points.length; i++) {
      out[i] = out[i - 1] + haversineMeters(points[i - 1], points[i]);
    }
    return out;
  }

  // vendor/mentra-miniapp/src/modules/pivots/instructions.ts
  var DIRECTION_WORDS = new Set(["right", "left", "the right", "the left", "north", "south", "east", "west"]);
  var MANEUVER_VERBS = /\b(turn|slight|sharp|continue|head|merge|exit|uturn|u-turn|then|keep)\b/i;
  function roadNameFromInstruction(instruction) {
    if (!instruction)
      return null;
    const firstLine = instruction.split(`
`)[0] ?? "";
    const m = firstLine.match(/\bonto\s+(.+)$/i);
    let raw = (m ? m[1] : "").trim();
    if (!raw)
      return null;
    if (raw.includes(","))
      return null;
    raw = raw.split(/\s+(?:toward|towards|to|and|then|for)\b/i)[0]?.trim() ?? "";
    raw = raw.replace(/\s+#.*$/, "").trim();
    if (!raw)
      return null;
    if (DIRECTION_WORDS.has(raw.toLowerCase()))
      return null;
    if (MANEUVER_VERBS.test(raw))
      return null;
    return raw;
  }
  var ROAD_SUFFIXES = /\b(st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|way|ct|court|pl|place|ter|terrace|hwy|highway)\b\.?/g;
  function normalizeRoad(road) {
    return road.toLowerCase().replace(ROAD_SUFFIXES, "").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  }
  function sameRoad(a, b) {
    return normalizeRoad(a) === normalizeRoad(b);
  }
  function turnDirection(maneuver) {
    if (!maneuver)
      return null;
    const m = maneuver.toUpperCase();
    if (m.includes("LEFT"))
      return "left";
    if (m.includes("RIGHT"))
      return "right";
    return null;
  }
  var PROBE_METERS = 22;
  function signedBendAt(points, junction) {
    if (points.length < 3)
      return null;
    let mid = 0;
    let bestDist = Infinity;
    for (let i = 0;i < points.length; i++) {
      const d = haversineMeters(points[i], junction);
      if (d < bestDist) {
        bestDist = d;
        mid = i;
      }
    }
    let before = mid;
    while (before > 0 && haversineMeters(points[before], points[mid]) < PROBE_METERS)
      before--;
    let after = mid;
    while (after < points.length - 1 && haversineMeters(points[after], points[mid]) < PROBE_METERS)
      after++;
    if (before === mid || after === mid)
      return null;
    const incoming = bearingDeg(points[before], points[mid]);
    const outgoing = bearingDeg(points[mid], points[after]);
    return signedAngleDiff(outgoing, incoming);
  }
  var MIN_TURN_ANGLE_DEG = 30;
  function extractPivotsFromComputedSteps(steps, polyline) {
    if (!steps || steps.length < 2)
      return [];
    const initial = steps.map((s, i) => ({
      stepIdx: i,
      name: s.road ?? roadNameFromInstruction(s.instruction)
    }));
    let annotated = initial;
    for (let pass = 0;pass < 4; pass++) {
      const collapsed = [];
      for (let i = 0;i < annotated.length; i++) {
        const prev = collapsed[collapsed.length - 1];
        const here = annotated[i];
        const next = annotated[i + 1];
        if (prev?.name && next?.name && here.name && !sameRoad(prev.name, here.name) && sameRoad(prev.name, next.name)) {
          continue;
        }
        collapsed.push(here);
      }
      if (collapsed.length === annotated.length)
        break;
      annotated = collapsed;
    }
    const out = [];
    for (let i = 0;i < annotated.length - 1; i++) {
      const here = annotated[i];
      const nextAnn = annotated[i + 1];
      const s = steps[here.stepIdx];
      const next = steps[nextAnn.stepIdx];
      const fromRoad = here.name;
      const toRoad = nextAnn.name;
      if (!fromRoad)
        continue;
      if (toRoad && sameRoad(fromRoad, toRoad))
        continue;
      if (!Number.isFinite(s.endLat) || !Number.isFinite(s.endLng))
        continue;
      const junction = { lat: s.endLat, lng: s.endLng };
      const signedBend = signedBendAt(polyline, junction);
      if (signedBend != null && Math.abs(signedBend) < MIN_TURN_ANGLE_DEG)
        continue;
      const geomDir = signedBend == null ? null : signedBend > 0 ? "right" : "left";
      const direction = geomDir ?? turnDirection(next.maneuver);
      out.push({
        lat: s.endLat,
        lng: s.endLng,
        fromRoad,
        toRoad,
        direction,
        maneuver: next.maneuver ?? (direction === "left" ? "TURN_LEFT" : "TURN_RIGHT")
      });
    }
    return out;
  }

  // vendor/mentra-miniapp/src/modules/pivots/engine.ts
  var RADIUS_DEFAULTS_M = {
    walking: 7,
    cycling: 15,
    driving: 40,
    two_wheeler: 25
  };
  var APPROACH_DEFAULTS_M = {
    walking: 100,
    cycling: 300,
    driving: 800,
    two_wheeler: 500
  };
  var NON_TURN_MANEUVERS = new Set(["STRAIGHT", "NAME_CHANGE", "DEPART", "ARRIVE"]);
  var STEP_MATCH_MAX_INDEX_DELTA = 8;
  var ON_ROUTE_PERP_TOLERANCE_M = 50;

  class PivotEngine {
    opts;
    pivots = [];
    states = [];
    cursor = 0;
    activePivotIndex = null;
    points = [];
    cumulative = [];
    roadNameResolver = null;
    routeGeneration = 0;
    subscribers = new Set;
    constructor(mode, opts) {
      this.opts = resolveOptions(mode, opts);
    }
    updateOptions(mode, opts) {
      this.opts = resolveOptions(mode, opts);
      for (const p of this.pivots) {
        p.radiusMeters = this.opts.radiusMeters;
      }
    }
    setRoadNameResolver(resolver) {
      this.roadNameResolver = resolver;
    }
    reset() {
      if (this.activePivotIndex !== null) {
        const active = this.pivots[this.activePivotIndex];
        if (active)
          this.emit({ kind: "exited", pivot: active });
      }
      this.pivots = [];
      this.states = [];
      this.cursor = 0;
      this.activePivotIndex = null;
      this.points = [];
      this.cumulative = [];
    }
    setRouteFromComputedSteps(route, computedSteps) {
      const points = route.points ?? [];
      if (this.activePivotIndex !== null) {
        const active = this.pivots[this.activePivotIndex];
        if (active)
          this.emit({ kind: "exited", pivot: active });
      }
      if (points.length < 3 || !computedSteps || computedSteps.length < 2) {
        this.setRoute(route, null);
        return;
      }
      const cumulative = cumulativeDistances(points);
      const instructionPivots = extractPivotsFromComputedSteps(computedSteps, points);
      console.log(`[PivotEngine] setRouteFromComputedSteps: steps=${computedSteps.length} instructionPivots=${instructionPivots.length}` + (instructionPivots.length > 0 ? `
` + instructionPivots.map((p, i) => `  pivot[${i}] ${p.fromRoad ?? "—"} → ${p.toRoad ?? "—"} dir=${p.direction} @ (${p.lat.toFixed(5)}, ${p.lng.toFixed(5)})`).join(`
`) : ""));
      if (instructionPivots.length === 0) {
        console.log(`[PivotEngine] falling back to setRoute (geometry) — input steps:
` + computedSteps.map((s, i) => `  step[${i}] road=${s.road ?? "—"} maneuver=${s.maneuver ?? "—"} @ (${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}) → (${s.endLat.toFixed(5)}, ${s.endLng.toFixed(5)})`).join(`
`));
        this.setRoute(route, null);
        return;
      }
      const pivots = instructionPivots.map((p, i) => ({
        index: i,
        lat: p.lat,
        lng: p.lng,
        direction: p.direction === "left" ? "left" : "right",
        fromRoad: p.fromRoad,
        toRoad: p.toRoad,
        maneuver: p.maneuver,
        distanceAlongRouteMeters: alongRouteAtCoord(points, cumulative, { lat: p.lat, lng: p.lng }),
        radiusMeters: this.opts.radiusMeters
      }));
      pivots.sort((a, b) => a.distanceAlongRouteMeters - b.distanceAlongRouteMeters);
      for (let i = 0;i < pivots.length; i++)
        pivots[i].index = i;
      this.pivots = pivots;
      this.states = pivots.map(() => ({ approachingFired: false, entered: false, exited: false }));
      this.cursor = 0;
      this.activePivotIndex = null;
      this.points = points;
      this.cumulative = cumulative;
      this.routeGeneration++;
      this._resolveMissingRoadNames(this.routeGeneration);
    }
    setRoute(route, _userPosition) {
      const points = route.points ?? [];
      const steps = route.steps ?? [];
      if (this.activePivotIndex !== null) {
        const active = this.pivots[this.activePivotIndex];
        if (active)
          this.emit({ kind: "exited", pivot: active });
      }
      if (points.length < 3) {
        this.pivots = [];
        this.states = [];
        this.cursor = 0;
        this.activePivotIndex = null;
        this.points = [];
        this.cumulative = [];
        return;
      }
      const cumulative = cumulativeDistances(points);
      const raw = extractPivots(points);
      const stepIndex = buildStepIndex(steps);
      const pivots = [];
      for (let i = 0;i < raw.length; i++) {
        const r = raw[i];
        const matched = matchStep(r, stepIndex);
        if (matched && NON_TURN_MANEUVERS.has(matched.maneuver)) {
          continue;
        }
        pivots.push({
          index: pivots.length,
          lat: r.lat,
          lng: r.lng,
          direction: r.direction,
          fromRoad: matched?.fromRoad ?? null,
          toRoad: matched?.toRoad ?? null,
          maneuver: matched?.maneuver ?? (r.direction === "left" ? "TURN_LEFT" : "TURN_RIGHT"),
          distanceAlongRouteMeters: distanceAtIndex(cumulative, r.rawRouteIndex),
          radiusMeters: this.opts.radiusMeters
        });
      }
      pivots.sort((a, b) => a.distanceAlongRouteMeters - b.distanceAlongRouteMeters);
      for (let i = 0;i < pivots.length; i++)
        pivots[i].index = i;
      this.pivots = pivots;
      this.states = pivots.map(() => ({ approachingFired: false, entered: false, exited: false }));
      this.cursor = 0;
      this.activePivotIndex = null;
      this.points = points;
      this.cumulative = cumulative;
      this.routeGeneration++;
      this._resolveMissingRoadNames(this.routeGeneration);
    }
    async _resolveMissingRoadNames(generation) {
      const pivots = this.pivots;
      if (pivots.length === 0)
        return;
      for (let i = 0;i < pivots.length - 1; i++) {
        const here = pivots[i];
        const next = pivots[i + 1];
        if (!here.toRoad && next.fromRoad)
          here.toRoad = next.fromRoad;
        if (!next.fromRoad && here.toRoad)
          next.fromRoad = here.toRoad;
      }
      for (let i = pivots.length - 1;i > 0; i--) {
        const here = pivots[i];
        const prev = pivots[i - 1];
        if (!prev.toRoad && here.fromRoad)
          prev.toRoad = here.fromRoad;
        if (!here.fromRoad && prev.toRoad)
          here.fromRoad = prev.toRoad;
      }
      const resolver = this.roadNameResolver;
      if (!resolver)
        return;
      if (this.points.length < 2)
        return;
      const SAMPLE_OFFSETS_M = [18, 30, 50, 80];
      const points = this.points;
      const cumulative = this.cumulative;
      const geocodeWithExpansion = async (pivotAlong, direction) => {
        for (const offset of SAMPLE_OFFSETS_M) {
          const sample = sampleAlongRoute(points, cumulative, pivotAlong + direction * offset);
          if (!sample)
            continue;
          try {
            const road = await resolver(sample);
            if (generation !== this.routeGeneration)
              return null;
            if (road)
              return road;
          } catch {}
        }
        return null;
      };
      const tasks = [];
      for (const pivot of pivots) {
        if (pivot.fromRoad && pivot.toRoad)
          continue;
        const along = pivot.distanceAlongRouteMeters;
        if (!pivot.fromRoad) {
          tasks.push(geocodeWithExpansion(along, -1).then((road) => {
            if (generation !== this.routeGeneration)
              return;
            if (road && !pivot.fromRoad)
              pivot.fromRoad = road;
          }));
        }
        if (!pivot.toRoad) {
          tasks.push(geocodeWithExpansion(along, 1).then((road) => {
            if (generation !== this.routeGeneration)
              return;
            if (road && !pivot.toRoad)
              pivot.toRoad = road;
          }));
        }
      }
      await Promise.all(tasks);
      if (generation !== this.routeGeneration)
        return;
      for (let i = 0;i < pivots.length - 1; i++) {
        const here = pivots[i];
        const next = pivots[i + 1];
        if (!here.toRoad && next.fromRoad)
          here.toRoad = next.fromRoad;
        if (!next.fromRoad && here.toRoad)
          next.fromRoad = here.toRoad;
      }
    }
    onLocationUpdate(coords) {
      if (this.pivots.length === 0)
        return;
      const projection = projectOntoPolyline(this.points, this.cumulative, coords);
      const useAlongPath = projection !== null && projection.perpMeters <= ON_ROUTE_PERP_TOLERANCE_M;
      const userAlong = projection?.alongMeters ?? 0;
      for (let i = this.cursor;i < this.pivots.length; i++) {
        const pivot = this.pivots[i];
        const state = this.states[i];
        if (state.exited)
          continue;
        const aheadDelta = pivot.distanceAlongRouteMeters - userAlong;
        const distanceToPivot = useAlongPath ? Math.abs(aheadDelta) : haversineMeters(coords, { lat: pivot.lat, lng: pivot.lng });
        const approaching = !state.approachingFired && distanceToPivot <= this.opts.approachThresholdMeters && (!useAlongPath || aheadDelta >= -this.opts.radiusMeters);
        if (approaching) {
          state.approachingFired = true;
          this.emit({ kind: "approaching", pivot, distanceMeters: distanceToPivot });
        }
        if (!state.entered && distanceToPivot <= pivot.radiusMeters) {
          state.entered = true;
          this.activePivotIndex = i;
          this.emit({ kind: "entered", pivot });
        }
        const movedPastOnPath = useAlongPath && aheadDelta < -pivot.radiusMeters;
        if ((state.entered && distanceToPivot > pivot.radiusMeters || !state.entered && movedPastOnPath) && !state.exited) {
          if (!state.entered) {
            state.entered = true;
            this.activePivotIndex = i;
            this.emit({ kind: "entered", pivot });
          }
          state.exited = true;
          if (this.activePivotIndex === i)
            this.activePivotIndex = null;
          this.emit({ kind: "exited", pivot });
          if (this.cursor <= i)
            this.cursor = i + 1;
        }
        if (!state.approachingFired && distanceToPivot > this.opts.approachThresholdMeters * 2) {
          break;
        }
      }
    }
    subscribe(fn) {
      this.subscribers.add(fn);
      return () => {
        this.subscribers.delete(fn);
      };
    }
    getPivots() {
      return this.pivots.slice();
    }
    getActivePivot() {
      if (this.activePivotIndex === null)
        return null;
      return this.pivots[this.activePivotIndex] ?? null;
    }
    getUpcomingPivot() {
      for (let i = this.cursor;i < this.pivots.length; i++) {
        if (!this.states[i].exited)
          return this.pivots[i];
      }
      return null;
    }
    emit(event) {
      for (const fn of this.subscribers) {
        try {
          fn(event);
        } catch (err) {
          console.error("[PivotEngine] subscriber threw:", err);
        }
      }
    }
  }
  function resolveOptions(mode, opts) {
    return {
      radiusMeters: opts?.radiusMeters ?? RADIUS_DEFAULTS_M[mode] ?? RADIUS_DEFAULTS_M.walking,
      approachThresholdMeters: opts?.approachThresholdMeters ?? APPROACH_DEFAULTS_M[mode] ?? APPROACH_DEFAULTS_M.walking
    };
  }
  function projectOntoPolyline(points, cumulative, user) {
    if (points.length < 2 || cumulative.length !== points.length)
      return null;
    const mPerDegLat = 111320;
    const mPerDegLng = 111320 * Math.cos(user.lat * Math.PI / 180);
    const ux = user.lng * mPerDegLng;
    const uy = user.lat * mPerDegLat;
    let bestPerp = Number.POSITIVE_INFINITY;
    let bestAlong = 0;
    for (let i = 0;i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const ax = a.lng * mPerDegLng;
      const ay = a.lat * mPerDegLat;
      const bx = b.lng * mPerDegLng;
      const by = b.lat * mPerDegLat;
      const dx = bx - ax;
      const dy = by - ay;
      const segLen2 = dx * dx + dy * dy;
      const t = segLen2 > 0 ? Math.max(0, Math.min(1, ((ux - ax) * dx + (uy - ay) * dy) / segLen2)) : 0;
      const px = ax + t * dx;
      const py = ay + t * dy;
      const perp = Math.hypot(ux - px, uy - py);
      if (perp < bestPerp) {
        bestPerp = perp;
        const segLen = Math.sqrt(segLen2);
        bestAlong = cumulative[i] + t * segLen;
      }
    }
    if (!Number.isFinite(bestPerp))
      return null;
    return { perpMeters: bestPerp, alongMeters: bestAlong };
  }
  function alongRouteAtCoord(points, cumulative, coord) {
    const projection = projectOntoPolyline(points, cumulative, coord);
    return projection?.alongMeters ?? 0;
  }
  function sampleAlongRoute(points, cumulative, targetMeters) {
    if (points.length < 2 || cumulative.length !== points.length)
      return null;
    const total = cumulative[cumulative.length - 1];
    if (!Number.isFinite(targetMeters))
      return null;
    if (targetMeters <= 0)
      return { lat: points[0].lat, lng: points[0].lng };
    if (targetMeters >= total) {
      const last = points[points.length - 1];
      return { lat: last.lat, lng: last.lng };
    }
    let lo = 0;
    let hi = cumulative.length - 1;
    while (lo + 1 < hi) {
      const mid = lo + hi >>> 1;
      if (cumulative[mid] <= targetMeters)
        lo = mid;
      else
        hi = mid;
    }
    const segStart = cumulative[lo];
    const segEnd = cumulative[hi];
    const segLen = segEnd - segStart;
    const t = segLen > 0 ? (targetMeters - segStart) / segLen : 0;
    const a = points[lo];
    const b = points[hi];
    return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
  }
  function distanceAtIndex(cumulative, idx) {
    if (cumulative.length === 0)
      return 0;
    if (idx < 0)
      return 0;
    if (idx >= cumulative.length)
      return cumulative[cumulative.length - 1];
    return cumulative[idx];
  }
  function buildStepIndex(steps) {
    if (!steps.length)
      return [];
    return steps.slice().sort((a, b) => a.routeIndex - b.routeIndex);
  }
  function matchStep(raw, stepIndex) {
    if (stepIndex.length < 2)
      return null;
    let bestJ = -1;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (let i = 1;i < stepIndex.length; i++) {
      const delta = Math.abs(stepIndex[i].routeIndex - raw.rawRouteIndex);
      if (delta <= bestDelta) {
        bestDelta = delta;
        bestJ = i;
      }
    }
    if (bestJ < 1)
      return null;
    if (bestDelta > STEP_MATCH_MAX_INDEX_DELTA)
      return null;
    const SHORT_TRANSIT_METERS = 25;
    const finalIndex = stepIndex.length - 1;
    let j = bestJ;
    while (j < finalIndex - 1 && stepIndex[j].distanceMeters > 0 && stepIndex[j].distanceMeters < SHORT_TRANSIT_METERS) {
      j++;
    }
    if (j >= finalIndex)
      j = finalIndex - 1;
    const fromStep = stepIndex[bestJ - 1];
    const toStep = stepIndex[j];
    return {
      fromRoad: fromStep.road ?? null,
      toRoad: toStep.road ?? null,
      maneuver: fromStep.maneuver
    };
  }

  // vendor/mentra-miniapp/src/modules/navigation.ts
  class NavigationModule {
    session;
    _pivots = new PivotEngine("walking", undefined);
    _tripUnsubs = [];
    _tripStops = null;
    _tripMode = "walking";
    _tripAvoid = undefined;
    _computeRouteSeq = 0;
    _lastUserPosition = null;
    constructor(session) {
      this.session = session;
      this._pivots.setRoadNameResolver(async (coord) => {
        try {
          const result = await this.reverseGeocodeRoad(coord);
          if (!result.ok)
            return null;
          return result.road ?? null;
        } catch {
          return null;
        }
      });
    }
    get hasPermission() {
      return this.session._hasManifestPermission("LOCATION");
    }
    requestPermission() {
      if (!this.hasPermission) {
        return Promise.resolve({
          ok: false,
          accepted: false,
          error: "LOCATION permission not declared in miniapp.json (required for navigation.requestPermission)."
        });
      }
      return this.session.sendRequest({
        type: "miniapp_navigation_request_permission" /* NAVIGATION_REQUEST_PERMISSION */
      });
    }
    async start(opts) {
      if (!this.hasPermission) {
        return {
          ok: false,
          error: "LOCATION permission not declared in miniapp.json (required for navigation.start)."
        };
      }
      const stops = normalizeStops(opts);
      const mode = opts.mode ?? "driving";
      this._tripStops = stops.length > 0 ? stops : null;
      this._tripMode = mode;
      this._tripAvoid = opts.avoid;
      this._attachPivotTrackingForTrip(mode, opts.pivots);
      const failStart = (error) => {
        this._detachPivotTracking();
        return { ok: false, error };
      };
      if (stops.length === 0) {
        return failStart("navigation.start: no stops");
      }
      let origin = this._lastUserPosition;
      if (!origin) {
        try {
          const fix = await this.session.location.getOnce();
          origin = { lat: fix.lat, lng: fix.lng };
          this._lastUserPosition = origin;
        } catch (err) {
          return failStart(`navigation.start: no GPS fix (${err instanceof Error ? err.message : String(err)})`);
        }
      }
      const restResult = await this.computeRoute({ origin, stops, mode, avoid: opts.avoid });
      if (!restResult.ok || !restResult.routes || restResult.routes.length === 0) {
        return failStart(restResult.error ?? "computeRoute failed");
      }
      const restRoute = restResult.routes[0];
      const nativeResult = await this.session.sendRequest({
        type: "miniapp_navigation_start" /* NAVIGATION_START */,
        lat: stops[0]?.lat,
        lng: stops[0]?.lng,
        stops,
        mode,
        avoid: opts.avoid,
        simulate: opts.simulate ?? false,
        speedMultiplier: opts.speedMultiplier ?? 1,
        missedTurnRerouteMeters: opts.missedTurnRerouteMeters
      });
      if (!nativeResult.ok) {
        this._detachPivotTracking();
        return nativeResult;
      }
      const syntheticRoute = buildNavRouteFromComputed(restRoute);
      this.session.events._forwardEvent("navigation_route" /* NAVIGATION_ROUTE */, syntheticRoute);
      return nativeResult;
    }
    stop() {
      this._detachPivotTracking();
      this.session.sendOneShot({ type: "miniapp_navigation_stop" /* NAVIGATION_STOP */ });
    }
    get dev() {
      return {
        deviate: (offsetMeters = 20) => {
          this.session.sendOneShot({ type: "miniapp_navigation_deviate" /* NAVIGATION_DEVIATE */, offsetMeters });
        },
        setWrongSidewalkOffset: (enabled) => {
          this.session.sendOneShot({ type: "miniapp_navigation_set_wrong_sidewalk" /* NAVIGATION_SET_WRONG_SIDEWALK */, enabled });
        },
        setSkipCrossings: (enabled) => {
          this.session.sendOneShot({ type: "miniapp_navigation_set_skip_crossings" /* NAVIGATION_SET_SKIP_CROSSINGS */, enabled });
        }
      };
    }
    onUpdate(handler) {
      return this.session._subscribe("navigation_update" /* NAVIGATION_UPDATE */, handler);
    }
    onRoute(handler) {
      return this.session._subscribe("navigation_route" /* NAVIGATION_ROUTE */, handler);
    }
    async getState() {
      const result = await this.session.sendRequest({
        type: "miniapp_navigation_get_state" /* NAVIGATION_GET_STATE */
      });
      return result.ok ? result.state ?? null : null;
    }
    computeRoute(opts) {
      if (!this.hasPermission) {
        return Promise.resolve({
          ok: false,
          error: "LOCATION permission not declared in miniapp.json (required for navigation.computeRoute)."
        });
      }
      return this.session.sendRequest({
        type: "miniapp_navigation_compute_route" /* NAVIGATION_COMPUTE_ROUTE */,
        origin: opts.origin,
        stops: opts.stops,
        mode: opts.mode ?? "driving",
        avoid: opts.avoid,
        alternatives: opts.alternatives ?? 1
      });
    }
    reverseGeocodeRoad(coord) {
      if (!this.hasPermission) {
        return Promise.resolve({
          ok: false,
          error: "LOCATION permission not declared in miniapp.json (required for reverseGeocodeRoad)."
        });
      }
      return this.session.sendRequest({
        type: "miniapp_navigation_reverse_geocode" /* NAVIGATION_REVERSE_GEOCODE */,
        lat: coord.lat,
        lng: coord.lng
      });
    }
    placeAutocomplete(opts) {
      return this.session.sendRequest({
        type: "miniapp_navigation_place_autocomplete" /* NAVIGATION_PLACE_AUTOCOMPLETE */,
        query: opts.query,
        near: opts.near ?? null,
        sessionToken: opts.sessionToken
      });
    }
    placeDetails(opts) {
      return this.session.sendRequest({
        type: "miniapp_navigation_place_details" /* NAVIGATION_PLACE_DETAILS */,
        placeId: opts.placeId,
        sessionToken: opts.sessionToken
      });
    }
    onPivot(handler) {
      return this._pivots.subscribe(handler);
    }
    getPivots() {
      return this._pivots.getPivots();
    }
    getActivePivot() {
      return this._pivots.getActivePivot();
    }
    getUpcomingPivot() {
      return this._pivots.getUpcomingPivot();
    }
    _attachPivotTrackingForTrip(mode, opts) {
      this._detachPivotTracking();
      this._pivots.reset();
      this._pivots.updateOptions(mode, opts);
      this._tripUnsubs.push(this.onRoute((route) => {
        if (route.steps && route.steps.length > 0) {
          const tail = route.points[route.points.length - 1];
          const computedSteps = route.steps.map((s, i) => {
            const next = route.steps?.[i + 1];
            const endLat = next ? next.lat : tail?.lat ?? s.lat;
            const endLng = next ? next.lng : tail?.lng ?? s.lng;
            return {
              lat: s.lat,
              lng: s.lng,
              endLat,
              endLng,
              distanceMeters: s.distanceMeters,
              maneuver: s.maneuver,
              road: s.road ?? undefined
            };
          });
          this._pivots.setRouteFromComputedSteps(route, computedSteps);
          return;
        }
        this._pivots.setRoute(route, null);
        const seq = ++this._computeRouteSeq;
        this._issueComputeRouteForTrip(route).then((result) => {
          if (seq !== this._computeRouteSeq)
            return;
          const computedSteps = result?.routes?.[0]?.steps;
          if (computedSteps && computedSteps.length > 0) {
            this._pivots.setRouteFromComputedSteps(route, computedSteps);
          }
        }).catch((err) => {
          console.warn("[NavigationModule] computeRoute for pivots failed:", err);
        });
      }));
      this._tripUnsubs.push(this.onUpdate((update) => {
        if (update.kind === "arrived") {
          this._pivots.reset();
          return;
        }
      }));
      this._tripUnsubs.push(this.session.location.onUpdate((loc) => {
        this._lastUserPosition = { lat: loc.lat, lng: loc.lng };
        this._pivots.onLocationUpdate({ lat: loc.lat, lng: loc.lng });
      }));
    }
    async _issueComputeRouteForTrip(route) {
      if (!this._tripStops || this._tripStops.length === 0)
        return null;
      const origin = this._lastUserPosition ?? (route?.points && route.points[0] ? { lat: route.points[0].lat, lng: route.points[0].lng } : null);
      if (!origin)
        return null;
      return this.computeRoute({
        origin,
        stops: this._tripStops,
        mode: this._tripMode,
        avoid: this._tripAvoid
      });
    }
    _detachPivotTracking() {
      for (const unsub of this._tripUnsubs) {
        try {
          unsub();
        } catch (err) {
          console.warn("[NavigationModule] pivot-tracking unsubscribe threw:", err);
        }
      }
      this._tripUnsubs = [];
      this._pivots.reset();
      this._tripStops = null;
      this._tripAvoid = undefined;
      this._computeRouteSeq++;
      this._lastUserPosition = null;
    }
  }
  function normalizeStops(opts) {
    if (opts.stops && opts.stops.length > 0) {
      return opts.stops;
    }
    if (typeof opts.lat === "number" && typeof opts.lng === "number") {
      return [{ lat: opts.lat, lng: opts.lng }];
    }
    return [];
  }
  function buildNavRouteFromComputed(computed) {
    const points = computed.points ?? [];
    const steps = (computed.steps ?? []).map((s) => {
      let routeIndex = 0;
      let best = Infinity;
      for (let i = 0;i < points.length; i++) {
        const dLat = points[i].lat - s.lat;
        const dLng = points[i].lng - s.lng;
        const d = dLat * dLat + dLng * dLng;
        if (d < best) {
          best = d;
          routeIndex = i;
        }
      }
      return {
        lat: s.lat,
        lng: s.lng,
        routeIndex,
        road: s.road ?? null,
        maneuver: s.maneuver ?? "STRAIGHT",
        distanceMeters: s.distanceMeters
      };
    });
    return {
      points,
      totalDistanceMeters: computed.totalDistanceMeters,
      totalDurationSeconds: computed.totalDurationSeconds,
      steps: steps.length > 0 ? steps : undefined
    };
  }

  // vendor/mentra-miniapp/src/modules/permissions.ts
  class PermissionsModule {
    session;
    constructor(session) {
      this.session = session;
    }
    has(type) {
      return this.session._getPermissions()[type] === true;
    }
    getAll() {
      return this.session._getPermissions();
    }
    onUpdate(handler) {
      return this.session.on("permissions", handler);
    }
    onPermissionError(handler) {
      return this.session.on("error", (e) => {
        const maybe = e;
        if (maybe?.code === "PERMISSION_NOT_DECLARED" /* PERMISSION_NOT_DECLARED */) {
          handler({
            code: String(maybe.code),
            message: String(maybe.message ?? ""),
            permission: maybe.permission,
            subscription: maybe.subscription,
            operation: maybe.operation
          });
        }
      });
    }
  }

  // vendor/mentra-miniapp/src/modules/phone.ts
  class TrackedSubs {
    unsubs = new Set;
    track(unsub) {
      this.unsubs.add(unsub);
      return () => {
        this.unsubs.delete(unsub);
        unsub();
      };
    }
    stop() {
      for (const u of this.unsubs) {
        try {
          u();
        } catch {}
      }
      this.unsubs.clear();
    }
  }

  class PhoneNotificationsModule extends TrackedSubs {
    session;
    constructor(session) {
      super();
      this.session = session;
    }
    on(handler) {
      return this.track(this.session._subscribe("phone_notification" /* PHONE_NOTIFICATION */, handler));
    }
    onDismissed(handler) {
      return this.track(this.session._subscribe("phone_notification_dismissed" /* PHONE_NOTIFICATION_DISMISSED */, handler));
    }
    get hasPermission() {
      return this.session._hasManifestPermission("READ_NOTIFICATIONS");
    }
  }

  class PhoneCalendarModule {
    session;
    constructor(session) {
      this.session = session;
    }
    listEvents(options) {
      const startsAt = normalizeCalendarDate(options?.startsAt, "startsAt");
      const endsAt = normalizeCalendarDate(options?.endsAt, "endsAt");
      return this.session.sendRequest({
        type: "miniapp_calendar_list_events" /* CALENDAR_LIST_EVENTS */,
        startsAt,
        endsAt,
        ...options.limit === undefined ? {} : { limit: options.limit }
      });
    }
    get hasPermission() {
      return this.session._hasManifestPermission("CALENDAR");
    }
  }
  function normalizeCalendarDate(value, field) {
    const date = value instanceof Date ? value : new Date(value ?? "");
    if (Number.isNaN(date.getTime()))
      throw new TypeError(`${field} must be a valid Date or ISO 8601 string`);
    return date.toISOString();
  }

  class PhoneModule {
    session;
    notifications;
    calendar;
    constructor(session) {
      this.session = session;
      this.notifications = new PhoneNotificationsModule(session);
      this.calendar = new PhoneCalendarModule(session);
    }
    isWifiEnabled() {
      return this.session.sendRequest({ type: "miniapp_phone_is_wifi_enabled" /* PHONE_IS_WIFI_ENABLED */ });
    }
    requestWifiEnable(reason) {
      return this.session.sendRequest({ type: "miniapp_phone_request_wifi_enable" /* PHONE_REQUEST_WIFI_ENABLE */, reason }, { timeoutMs: 0 });
    }
    onBattery(handler) {
      return this.session._subscribe("phone_battery" /* PHONE_BATTERY */, handler);
    }
  }

  // vendor/mentra-cloud-protocol/src/languages.ts
  var CANONICAL_TAG_BY_CODE = {
    af: "af-ZA",
    am: "am-ET",
    ar: "ar-AE",
    az: "az-AZ",
    be: "be-BY",
    bg: "bg-BG",
    bn: "bn-IN",
    bs: "bs-BA",
    ca: "ca-ES",
    cs: "cs-CZ",
    cy: "cy-GB",
    da: "da-DK",
    de: "de-DE",
    el: "el-GR",
    en: "en-US",
    es: "es-ES",
    et: "et-EE",
    eu: "eu-ES",
    fa: "fa-IR",
    fi: "fi-FI",
    fr: "fr-FR",
    gl: "gl-ES",
    gu: "gu-IN",
    he: "he-IL",
    hi: "hi-IN",
    hr: "hr-HR",
    hu: "hu-HU",
    hy: "hy-AM",
    id: "id-ID",
    it: "it-IT",
    ja: "ja-JP",
    ka: "ka-GE",
    kk: "kk-KZ",
    kn: "kn-IN",
    ko: "ko-KR",
    lt: "lt-LT",
    lv: "lv-LV",
    mk: "mk-MK",
    ml: "ml-IN",
    mr: "mr-IN",
    ms: "ms-MY",
    nb: "nb-NO",
    ne: "ne-NP",
    nl: "nl-NL",
    no: "nb-NO",
    pa: "pa-IN",
    pl: "pl-PL",
    pt: "pt-BR",
    ro: "ro-RO",
    ru: "ru-RU",
    sk: "sk-SK",
    sl: "sl-SI",
    sq: "sq-AL",
    sr: "sr-RS",
    sv: "sv-SE",
    sw: "sw-KE",
    ta: "ta-IN",
    te: "te-IN",
    th: "th-TH",
    tl: "fil-PH",
    tr: "tr-TR",
    uk: "uk-UA",
    ur: "ur-IN",
    vi: "vi-VN",
    zh: "zh-CN"
  };
  var EXTRA_REGIONAL_TAGS = [
    "ar-EG",
    "ar-SA",
    "de-AT",
    "de-CH",
    "en-AU",
    "en-CA",
    "en-GB",
    "en-IN",
    "es-419",
    "es-MX",
    "es-US",
    "fr-CA",
    "nl-BE",
    "pt-PT",
    "zh-HK",
    "zh-TW"
  ];
  var SUPPORTED_LANGUAGE_HINTS = Object.freeze([...new Set(Object.keys(CANONICAL_TAG_BY_CODE))].sort());
  var SUPPORTED_TRANSCRIPTION_LANGUAGES = Object.freeze([
    ...new Set([
      ...Object.values(CANONICAL_TAG_BY_CODE),
      ...EXTRA_REGIONAL_TAGS
    ])
  ].sort());
  var TAG_SET = new Set(SUPPORTED_TRANSCRIPTION_LANGUAGES);
  var HINT_SET = new Set(SUPPORTED_LANGUAGE_HINTS);
  function toTranscriptionLanguage(value) {
    if (TAG_SET.has(value))
      return value;
    const canonical = CANONICAL_TAG_BY_CODE[value.toLowerCase()];
    return canonical ?? null;
  }
  function toLanguageHint(value) {
    const primary = value.split("-")[0].toLowerCase();
    return HINT_SET.has(primary) ? primary : null;
  }
  function suggestTranscriptionLanguage(value) {
    const normalized = value.replace(/_/g, "-");
    const parts = normalized.split("-");
    const recased = parts.length >= 2 ? `${parts[0].toLowerCase()}-${parts[1].toUpperCase()}` : normalized.toLowerCase();
    return toTranscriptionLanguage(recased);
  }

  // vendor/mentra-miniapp/src/modules/languages.ts
  class MiniappValidationError extends Error {
    constructor(message) {
      super(message);
      this.name = "MiniappValidationError";
    }
  }
  function requireTranscriptionLanguage(value, param) {
    const canonical = toTranscriptionLanguage(value);
    if (canonical)
      return canonical;
    const suggestion = suggestTranscriptionLanguage(value);
    throw new MiniappValidationError(`${param}: unknown language ${JSON.stringify(value)}` + (suggestion ? ` — did you mean ${JSON.stringify(suggestion)}?` : "") + ` Supported values are BCP-47 tags from SUPPORTED_TRANSCRIPTION_LANGUAGES (e.g. "en-US", "fr-FR").`);
  }
  function requireLanguageHint(value, param) {
    const hint = toLanguageHint(value);
    if (hint)
      return hint;
    throw new MiniappValidationError(`${param}: unknown language hint ${JSON.stringify(value)}. ` + `Hints are bare ISO 639-1 codes from SUPPORTED_LANGUAGE_HINTS (e.g. "en", "fr").`);
  }

  // vendor/mentra-miniapp/src/modules/transcription.ts
  class TranscriptionModule {
    session;
    unsubs = new Set;
    currentConfig = null;
    constructor(session) {
      this.session = session;
    }
    on(handler, options = {}) {
      return this.track(this.session._subscribe(`${"transcription" /* TRANSCRIPTION */}:auto`, handler, options));
    }
    forLanguage(language, handler, options = {}) {
      const langs = (Array.isArray(language) ? language : [language]).map((lang) => requireTranscriptionLanguage(lang, "transcription.forLanguage(language)"));
      if (langs.length === 0)
        return () => {};
      const unsubs = [];
      for (const lang of langs) {
        unsubs.push(this.session._subscribe(`${"transcription" /* TRANSCRIPTION */}:${lang}`, handler, options));
      }
      const combined = () => {
        for (const u of unsubs) {
          try {
            u();
          } catch {}
        }
      };
      return this.track(combined);
    }
    configure(config) {
      const normalized = {
        ...config,
        languageHints: config.languageHints?.map((hint) => requireLanguageHint(hint, "transcription.configure(languageHints)"))
      };
      this.currentConfig = { ...normalized };
      return this.session.sendRequest({
        type: "miniapp_transcription_config" /* TRANSCRIPTION_CONFIG */,
        config: { ...normalized }
      }).then(() => {
        return;
      });
    }
    stop() {
      for (const u of this.unsubs) {
        try {
          u();
        } catch {}
      }
      this.unsubs.clear();
    }
    get hasPermission() {
      return this.session._hasManifestPermission("MICROPHONE");
    }
    _getConfig() {
      return this.currentConfig ? { ...this.currentConfig } : null;
    }
    track(unsub) {
      this.unsubs.add(unsub);
      return () => {
        this.unsubs.delete(unsub);
        unsub();
      };
    }
  }

  // vendor/mentra-miniapp/src/modules/translation.ts
  class TranslationModule {
    session;
    unsubs = new Set;
    constructor(session) {
      this.session = session;
    }
    on(handler) {
      return this.track(this.session._subscribe(`${"translation" /* TRANSLATION */}:*:*`, handler));
    }
    to(target, handler) {
      const targets = (Array.isArray(target) ? target : [target]).map((t) => requireTranscriptionLanguage(t, "translation.to(target)"));
      if (targets.length === 0)
        return () => {};
      const unsubs = [];
      for (const t of targets) {
        unsubs.push(this.session._subscribe(`${"translation" /* TRANSLATION */}:*:${t}`, handler));
      }
      const composite = () => {
        for (const u of unsubs) {
          try {
            u();
          } catch {}
        }
      };
      return this.track(composite);
    }
    fromTo(source, target, handler) {
      const validSource = source === "auto" ? "auto" : requireTranscriptionLanguage(source, "translation.fromTo(source)");
      const targets = (Array.isArray(target) ? target : [target]).map((t) => requireTranscriptionLanguage(t, "translation.fromTo(target)"));
      if (targets.length === 0)
        return () => {};
      const unsubs = [];
      for (const t of targets) {
        unsubs.push(this.session._subscribe(`${"translation" /* TRANSLATION */}:${validSource}:${t}`, handler));
      }
      const composite = () => {
        for (const u of unsubs) {
          try {
            u();
          } catch {}
        }
      };
      return this.track(composite);
    }
    forLanguagePair(fromLang, toLang, handler) {
      return this.fromTo(fromLang, toLang, handler);
    }
    stop() {
      for (const u of this.unsubs) {
        try {
          u();
        } catch {}
      }
      this.unsubs.clear();
    }
    get hasPermission() {
      return this.session._hasManifestPermission("MICROPHONE");
    }
    track(unsub) {
      this.unsubs.add(unsub);
      return () => {
        this.unsubs.delete(unsub);
        unsub();
      };
    }
  }

  // vendor/mentra-miniapp/src/modules/ui.ts
  function rpcErrorFromUnknown(e) {
    if (e instanceof Error) {
      const own = e;
      const cause = own.cause;
      return compactEnvelope({
        message: e.message,
        code: own.code ?? cause?.code,
        stage: own.stage,
        transport: own.transport
      });
    }
    if (e && typeof e === "object") {
      const o = e;
      return compactEnvelope({
        message: typeof o.message === "string" ? o.message : JSON.stringify(e),
        code: typeof o.code === "string" ? o.code : undefined,
        stage: typeof o.stage === "string" ? o.stage : undefined,
        transport: typeof o.transport === "string" ? o.transport : undefined
      });
    }
    return { message: String(e) };
  }
  function compactEnvelope(env) {
    const out = { message: env.message };
    if (env.code)
      out.code = env.code;
    if (env.stage)
      out.stage = env.stage;
    if (env.transport)
      out.transport = env.transport;
    return out;
  }

  class UIModuleImpl {
    session;
    bound = false;
    nextSeq = 1;
    openHandlers = new Set;
    closeHandlers = new Set;
    channelHandlers = new Map;
    rpcHandlers = new Map;
    inflightRpc = new Map;
    constructor(session) {
      this.session = session;
      this.session._subscribe("_ui", (env) => this.handleInbound(env));
    }
    isOpen = () => {
      return this.bound;
    };
    onOpen = (cb) => {
      this.openHandlers.add(cb);
      if (this.bound) {
        if (this.session.ready) {
          try {
            cb();
          } catch (e) {
            console.warn("session.ui.onOpen late-fire threw:", e);
          }
        }
      }
      return () => {
        this.openHandlers.delete(cb);
      };
    };
    onClose = (cb) => {
      this.closeHandlers.add(cb);
      return () => {
        this.closeHandlers.delete(cb);
      };
    };
    send = (channel, payload) => {
      if (!this.bound) {
        return;
      }
      const seq = this.nextSeq++;
      const envelope = { type: "UI_SEND", channel, payload, seq };
      this.session.sendOneShot(envelope);
    };
    on = (channel, cb) => {
      let set = this.channelHandlers.get(channel);
      if (!set) {
        set = new Set;
        this.channelHandlers.set(channel, set);
      }
      set.add(cb);
      return () => {
        set.delete(cb);
      };
    };
    handle = (channel, handler) => {
      const key = channel;
      if (this.rpcHandlers.has(key)) {
        throw new Error(`session.ui.handle: a handler is already registered for "${key}"`);
      }
      this.rpcHandlers.set(key, handler);
      return () => {
        this.rpcHandlers.delete(key);
      };
    };
    fireOpenHandlers() {
      for (const h of this.openHandlers) {
        try {
          h();
        } catch (e) {
          console.warn("session.ui.onOpen handler threw", e);
        }
      }
    }
    handleInbound(env) {
      if (env.type === "UI_OPEN") {
        this.bound = true;
        this.nextSeq = 1;
        if (this.session.ready) {
          this.fireOpenHandlers();
        } else {
          const off = this.session.on("ready", () => {
            off();
            if (this.bound)
              this.fireOpenHandlers();
          });
        }
        return;
      }
      if (env.type === "UI_CLOSE") {
        this.bound = false;
        for (const h of this.closeHandlers) {
          try {
            h();
          } catch (e) {
            console.warn("session.ui.onClose handler threw", e);
          }
        }
        return;
      }
      if (env.type === "UI_MESSAGE") {
        if (typeof env.requestId === "string") {
          this.dispatchRpcCall(env.channel, env.payload, env.requestId);
          return;
        }
        const set = this.channelHandlers.get(env.channel);
        if (!set || set.size === 0)
          return;
        for (const h of set) {
          try {
            h(env.payload);
          } catch (e) {
            console.warn(`session.ui.on(${env.channel}) threw`, e);
          }
        }
        return;
      }
      if (env.type === "UI_CANCEL") {
        const ctrl = this.inflightRpc.get(env.requestId);
        if (ctrl) {
          try {
            ctrl.abort();
          } catch {}
        }
        return;
      }
    }
    dispatchRpcCall(channel, payload, requestId) {
      const handler = this.rpcHandlers.get(channel);
      if (!handler) {
        this.sendRpcReply(channel, requestId, {
          ok: false,
          error: { message: `no handler registered for "${channel}"` }
        });
        return;
      }
      const ctrl = new AbortController;
      this.inflightRpc.set(requestId, ctrl);
      const ctx = { signal: ctrl.signal };
      const finish = (envelope) => {
        this.inflightRpc.delete(requestId);
        if (ctrl.signal.aborted)
          return;
        this.sendRpcReply(channel, requestId, envelope);
      };
      let result;
      try {
        result = handler(payload, ctx);
      } catch (e) {
        finish({ ok: false, error: rpcErrorFromUnknown(e) });
        return;
      }
      if (result && typeof result.then === "function") {
        result.then((v) => finish({ ok: true, result: v }), (e) => finish({ ok: false, error: rpcErrorFromUnknown(e) }));
      } else {
        finish({ ok: true, result });
      }
    }
    sendRpcReply(channel, requestId, payload) {
      if (!this.bound)
        return;
      const seq = this.nextSeq++;
      const envelope = { type: "UI_SEND", channel, payload, seq, requestId };
      this.session.sendOneShot(envelope);
    }
  }

  // vendor/mentra-miniapp/src/modules/storage.ts
  class SimpleStorage {
    session;
    constructor(session) {
      this.session = session;
    }
    async get(key) {
      const result = await this.session.sendRequest({
        type: "miniapp_storage_get" /* STORAGE_GET */,
        key
      });
      return result?.value ?? null;
    }
    async set(key, value) {
      await this.session.sendRequest({
        type: "miniapp_storage_set" /* STORAGE_SET */,
        key,
        value
      });
    }
    async delete(key) {
      await this.session.sendRequest({
        type: "miniapp_storage_delete" /* STORAGE_DELETE */,
        key
      });
    }
    async keys() {
      const result = await this.session.sendRequest({
        type: "miniapp_storage_list" /* STORAGE_LIST */
      });
      return result?.keys ?? [];
    }
    async list() {
      return this.keys();
    }
    async clear() {
      await this.session.sendRequest({
        type: "miniapp_storage_clear" /* STORAGE_CLEAR */
      });
    }
    async has(key) {
      const result = await this.session.sendRequest({
        type: "miniapp_storage_has" /* STORAGE_HAS */,
        key
      });
      return !!result?.has;
    }
    async getAll() {
      const result = await this.session.sendRequest({
        type: "miniapp_storage_get_all" /* STORAGE_GET_ALL */
      });
      return result?.values ?? {};
    }
    async setMultiple(values) {
      await this.session.sendRequest({
        type: "miniapp_storage_set_multiple" /* STORAGE_SET_MULTIPLE */,
        values
      });
    }
    async flush() {
      await this.session.sendRequest({
        type: "miniapp_storage_flush" /* STORAGE_FLUSH */
      });
    }
  }

  // vendor/mentra-miniapp/src/modules/base64.ts
  var ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  var LOOKUP = (() => {
    const t = new Int16Array(256).fill(-1);
    for (let i = 0;i < ALPHABET.length; i++)
      t[ALPHABET.charCodeAt(i)] = i;
    t[61] = 0;
    return t;
  })();
  function toUint8Array(input) {
    if (input instanceof Uint8Array)
      return input;
    if (input instanceof ArrayBuffer)
      return new Uint8Array(input);
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  function bytesToBase64(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    const len = bytes.length;
    let out = "";
    let i = 0;
    for (;i + 2 < len; i += 3) {
      const n = bytes[i] << 16 | bytes[i + 1] << 8 | bytes[i + 2];
      out += ALPHABET[n >> 18 & 63] + ALPHABET[n >> 12 & 63] + ALPHABET[n >> 6 & 63] + ALPHABET[n & 63];
    }
    const rem = len - i;
    if (rem === 1) {
      const n = bytes[i] << 16;
      out += ALPHABET[n >> 18 & 63] + ALPHABET[n >> 12 & 63] + "==";
    } else if (rem === 2) {
      const n = bytes[i] << 16 | bytes[i + 1] << 8;
      out += ALPHABET[n >> 18 & 63] + ALPHABET[n >> 12 & 63] + ALPHABET[n >> 6 & 63] + "=";
    }
    return out;
  }
  function base64ToBytes(b64) {
    let validChars = 0;
    let pad = 0;
    for (let i = 0;i < b64.length; i++) {
      const c = b64.charCodeAt(i);
      if (c === 61) {
        pad++;
        validChars++;
      } else if (LOOKUP[c] !== -1) {
        validChars++;
      }
    }
    const fullGroups = Math.floor(validChars / 4);
    const remChars = validChars - fullGroups * 4;
    let outLen = fullGroups * 3 - (pad > 0 && remChars === 0 ? pad : 0);
    if (remChars === 2)
      outLen += 1;
    else if (remChars === 3)
      outLen += 2;
    if (outLen < 0)
      outLen = 0;
    const out = new Uint8Array(outLen);
    let acc = 0;
    let bits = 0;
    let o = 0;
    for (let i = 0;i < b64.length && o < outLen; i++) {
      const c = b64.charCodeAt(i);
      if (c === 61)
        break;
      const v = LOOKUP[c];
      if (v === -1)
        continue;
      acc = acc << 6 | v;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        out[o++] = acc >> bits & 255;
      }
    }
    return out;
  }

  // vendor/mentra-miniapp/src/modules/speaker.ts
  var SPEAKER_WRITE_CHUNK_BYTES = 256 * 1024;
  var SPEAKER_WRITE_CHUNK_B64 = Math.floor(SPEAKER_WRITE_CHUNK_BYTES / 6) * 8;
  class SpeakerStreamWriter {
    session;
    streamId;
    settled = false;
    writeChain = Promise.resolve();
    constructor(session, streamId) {
      this.session = session;
      this.streamId = streamId;
    }
    async write(chunk) {
      this.assertOpen();
      const bytes = toUint8Array(chunk);
      if (bytes.byteLength === 0)
        throw new Error("PCM chunk cannot be empty");
      if (bytes.byteLength % 2 !== 0)
        throw new Error("PCM chunk must contain complete 16-bit samples");
      return this.enqueueWrite(async () => {
        let last = { bufferedMs: 0 };
        for (let off = 0;off < bytes.length; off += SPEAKER_WRITE_CHUNK_BYTES) {
          last = await this.send(bytesToBase64(bytes.subarray(off, off + SPEAKER_WRITE_CHUNK_BYTES)));
        }
        return last;
      });
    }
    async writeBase64(b64) {
      this.assertOpen();
      if (b64.length === 0 || b64.length % 4 !== 0)
        throw new Error("PCM base64 must be non-empty and padded");
      const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
      const decodedBytes = b64.length / 4 * 3 - padding;
      if (decodedBytes % 2 !== 0)
        throw new Error("PCM base64 must contain complete 16-bit samples");
      return this.enqueueWrite(async () => {
        let last = { bufferedMs: 0 };
        for (let off = 0;off < b64.length; off += SPEAKER_WRITE_CHUNK_B64) {
          last = await this.send(b64.slice(off, off + SPEAKER_WRITE_CHUNK_B64));
        }
        return last;
      });
    }
    async close() {
      this.assertOpen();
      this.settled = true;
      await this.writeChain;
      const res = await this.session.sendRequest({ type: "miniapp_speaker_stream_close" /* SPEAKER_STREAM_CLOSE */, streamId: this.streamId }, { timeoutMs: 0 });
      return res ?? {};
    }
    async abort() {
      if (this.settled)
        return;
      this.settled = true;
      await this.session.sendRequest({
        type: "miniapp_speaker_stream_abort" /* SPEAKER_STREAM_ABORT */,
        streamId: this.streamId
      });
    }
    assertOpen() {
      if (this.settled)
        throw new Error("SpeakerStreamWriter is already closed/aborted");
    }
    async send(base64) {
      const res = await this.session.sendRequest({
        type: "miniapp_speaker_stream_write" /* SPEAKER_STREAM_WRITE */,
        streamId: this.streamId,
        base64
      });
      return res ?? { bufferedMs: 0 };
    }
    enqueueWrite(operation) {
      const result = this.writeChain.then(operation);
      this.writeChain = result.then(() => {
        return;
      }, () => {
        return;
      });
      return result;
    }
  }

  class SpeakerModule {
    session;
    _state = "idle";
    _lastEvent = { state: "idle" };
    constructor(session) {
      this.session = session;
    }
    get state() {
      return this._state;
    }
    get isPlaying() {
      return this._state === "playing";
    }
    async play(options) {
      if (options.startPositionMs !== undefined && (!Number.isFinite(options.startPositionMs) || options.startPositionMs < 0)) {
        throw new RangeError("startPositionMs must be a finite, non-negative number");
      }
      await this.session.sendRequest({
        type: "miniapp_play_audio" /* PLAY_AUDIO */,
        audioUrl: options.audioUrl,
        ...options.startPositionMs !== undefined ? { startPositionMs: options.startPositionMs } : {},
        volume: options.volume,
        stopOtherAudio: options.stopOtherAudio ?? false
      }, { timeoutMs: 0 });
    }
    async speak(text, options = {}) {
      const normalized = Array.isArray(text) ? text.map((sentence) => sentence.trim()).filter(Boolean) : text.trim();
      if (Array.isArray(normalized) && normalized.length === 0 || normalized === "") {
        throw { code: "INTERNAL" /* INTERNAL */, message: "speak requires at least one non-empty sentence" };
      }
      try {
        const result = await this.session.sendRequest({
          type: "miniapp_speak" /* SPEAK */,
          text: normalized,
          voice_id: options.voice_id,
          voice_settings: options.voice_settings,
          volume: options.volume,
          stopOtherAudio: options.stopOtherAudio ?? false,
          enableSanitization: options.enableSanitization ?? true,
          forceLocal: options.forceLocal ?? false
        }, { timeoutMs: 0 });
        return result ?? { completed: true };
      } catch (err) {
        if (err && typeof err === "object" && "code" in err) {
          throw err;
        }
        throw { code: "INTERNAL" /* INTERNAL */, message: String(err) };
      }
    }
    async createStream(options = {}) {
      if (options.volume !== undefined && (!Number.isFinite(options.volume) || options.volume < 0 || options.volume > 1)) {
        throw new RangeError("speaker stream volume must be between 0 and 1");
      }
      const res = await this.session.sendRequest({
        type: "miniapp_speaker_stream_open" /* SPEAKER_STREAM_OPEN */,
        sampleRate: options.sampleRate ?? 16000,
        channels: options.channels ?? 1,
        volume: options.volume,
        stopOtherAudio: options.stopOtherAudio ?? true
      });
      return new SpeakerStreamWriter(this.session, res.streamId);
    }
    stop() {
      this.session.sendOneShot({ type: "miniapp_stop_audio" /* STOP_AUDIO */ });
    }
    onStateChange(handler) {
      return this.session.on("speakerState", handler);
    }
    _applyState(event) {
      if (event.state === this._state && event.state !== "error")
        return;
      this._state = event.state;
      this._lastEvent = event;
    }
    _getLastEvent() {
      return { ...this._lastEvent };
    }
  }

  // vendor/mentra-miniapp/src/modules/stream.ts
  class PreviewError extends Error {
    code;
    constructor(code, message) {
      super(message ?? code);
      this.name = "PreviewError";
      this.code = code;
    }
  }
  function toPreviewError(error) {
    if (error instanceof PreviewError)
      return error;
    const value = error ?? {};
    const code = typeof value.code === "string" ? value.code : "unsupported";
    const message = typeof value.message === "string" ? value.message : undefined;
    return new PreviewError(code, message);
  }

  class PreviewHandleImpl {
    source;
    handleId;
    previewTraceId;
    release;
    state = "held";
    listeners = new Set;
    constructor(source, handleId, previewTraceId, release) {
      this.source = source;
      this.handleId = handleId;
      this.previewTraceId = previewTraceId;
      this.release = release;
    }
    async stop() {
      if (this.state === "ended")
        return;
      this.end("stopped");
      await this.release(this);
    }
    onStatus(cb) {
      this.listeners.add(cb);
      return () => this.listeners.delete(cb);
    }
    end(reason) {
      if (this.state === "ended")
        return;
      this.state = "ended";
      this.emit({ state: "ended", reason });
    }
    emit(status) {
      for (const listener of [...this.listeners]) {
        try {
          listener(status);
        } catch {}
      }
    }
  }

  class StreamModule {
    session;
    previewHandles = new Map;
    constructor(session) {
      this.session = session;
    }
    async preview(options = {}) {
      const source = options.source ?? "call";
      if (source !== "call") {
        throw new PreviewError("unsupported", `Preview source "${String(source)}" is not supported yet`);
      }
      let result;
      try {
        result = await this.session.sendRequest({
          type: "miniapp_stream_preview_start" /* STREAM_PREVIEW_START */,
          source
        });
      } catch (error) {
        throw toPreviewError(error);
      }
      const handle = new PreviewHandleImpl(result.source ?? source, result.handleId, result.previewTraceId, (h) => this.releasePreview(h));
      this.previewHandles.set(handle.handleId, handle);
      handle.onStatus((status) => {
        if (status.state === "ended")
          this.previewHandles.delete(handle.handleId);
      });
      return handle;
    }
    async releasePreview(handle) {
      this.previewHandles.delete(handle.handleId);
      try {
        await this.session.sendRequest({
          type: "miniapp_stream_preview_stop" /* STREAM_PREVIEW_STOP */,
          handleId: handle.handleId
        });
      } catch (error) {
        throw toPreviewError(error);
      }
    }
    _applyPreviewStatus(payload) {
      if (typeof payload.handleId !== "string")
        return;
      const handle = this.previewHandles.get(payload.handleId);
      if (!handle)
        return;
      if (payload.state === "ended") {
        handle.end(typeof payload.reason === "string" ? payload.reason : "ended");
      }
    }
    async startStream(options = {}) {
      if (options.direct !== undefined) {
        return this.session.sendRequest({
          type: "miniapp_stream_start" /* STREAM_START */,
          streamUrl: options.direct,
          video: options.video,
          audio: options.audio,
          sound: options.sound ?? true,
          ...options.authToken ? { authToken: options.authToken } : {},
          ...typeof options.captureAudio === "boolean" ? { captureAudio: options.captureAudio } : {}
        });
      }
      return this.session.sendRequest({
        type: "miniapp_managed_stream_start" /* MANAGED_STREAM_START */,
        restreamDestinations: options.destinations,
        video: options.video,
        audio: options.audio,
        sound: options.sound ?? true,
        ingest: options.ingest,
        ...typeof options.captureAudio === "boolean" ? { captureAudio: options.captureAudio } : {}
      });
    }
    async stop(streamId) {
      await this.session.sendRequest({
        type: "miniapp_stream_stop" /* STREAM_STOP */,
        streamId
      });
    }
  }

  // vendor/mentra-miniapp/src/modules/system.ts
  class SystemModule {
    session;
    constructor(session) {
      this.session = session;
    }
    async share(options) {
      const result = await this.session.sendRequest({
        type: "miniapp_share" /* SHARE */,
        ...options
      });
      return result ?? { success: false };
    }
    openUrl(url) {
      this.session.sendOneShot({
        type: "miniapp_open_url" /* OPEN_URL */,
        url
      });
    }
    async copyToClipboard(text) {
      await this.session.sendRequest({
        type: "miniapp_copy_clipboard" /* COPY_CLIPBOARD */,
        text
      });
    }
    async download(options) {
      const result = await this.session.sendRequest({
        type: "miniapp_download" /* DOWNLOAD */,
        ...options
      });
      return result ?? { success: false };
    }
    async scanQr(options = {}) {
      const result = await this.session.sendRequest({
        type: "miniapp_scan_qr" /* SCAN_QR */,
        ...options
      }, { timeoutMs: 0 });
      return result ?? { cancelled: true };
    }
  }

  // vendor/mentra-miniapp/src/modules/miniapps.ts
  class MiniappsModule {
    session;
    constructor(session) {
      this.session = session;
    }
    async list(opts) {
      const result = await this.session.sendRequest({
        type: "miniapp_apps_list" /* MINIAPPS_LIST */,
        includeIncompatible: opts?.includeIncompatible ?? false
      });
      return result ?? [];
    }
    async start(packageName) {
      await this.session.sendRequest({
        type: "miniapp_apps_start" /* MINIAPPS_START */,
        packageName
      });
    }
    async stop(packageName) {
      await this.session.sendRequest({
        type: "miniapp_apps_stop" /* MINIAPPS_STOP */,
        packageName
      });
    }
  }

  // vendor/mentra-miniapp/src/modules/actions.ts
  var HANDLER_WAIT_MS = 5000;

  class ActionsModule {
    session;
    handlers = new Map;
    buffered = new Map;
    constructor(session) {
      this.session = session;
    }
    invoke(packageName, actionId, params, opts) {
      return this.session.sendRequest({
        type: "miniapp_action_invoke" /* ACTION_INVOKE */,
        targetPackageName: packageName,
        actionId,
        params: params ?? {},
        ...opts?.timeoutMs != null ? { timeoutMs: opts.timeoutMs } : {}
      });
    }
    handle(actionId, handler) {
      if (this.handlers.has(actionId)) {
        throw new Error(`session.actions.handle: a handler is already registered for "${actionId}"`);
      }
      this.handlers.set(actionId, handler);
      const waiting = this.buffered.get(actionId);
      if (waiting) {
        this.buffered.delete(actionId);
        for (const call of waiting) {
          clearTimeout(call.timer);
          this.dispatch(call.callId, actionId, call.params, call.ctx);
        }
      }
      return () => {
        if (this.handlers.get(actionId) === handler)
          this.handlers.delete(actionId);
      };
    }
    _deliver(callId, actionId, params, ctx) {
      if (this.handlers.has(actionId)) {
        this.dispatch(callId, actionId, params, ctx);
        return;
      }
      const timer = setTimeout(() => {
        const arr = this.buffered.get(actionId);
        if (arr) {
          const idx = arr.findIndex((c) => c.callId === callId);
          if (idx >= 0)
            arr.splice(idx, 1);
          if (arr.length === 0)
            this.buffered.delete(actionId);
        }
        this.sendResult(callId, false, undefined, {
          code: "NO_ACTION_HANDLER" /* NO_ACTION_HANDLER */,
          message: `No handler registered for action "${actionId}"`
        });
      }, HANDLER_WAIT_MS);
      const arr = this.buffered.get(actionId) ?? [];
      arr.push({ callId, params, ctx, timer });
      this.buffered.set(actionId, arr);
    }
    async dispatch(callId, actionId, params, ctx) {
      const handler = this.handlers.get(actionId);
      if (!handler)
        return;
      try {
        const result = await handler(params, ctx);
        this.sendResult(callId, true, result ?? null);
      } catch (e) {
        this.sendResult(callId, false, undefined, {
          code: "INTERNAL" /* INTERNAL */,
          message: e?.message ?? "action handler threw"
        });
      }
    }
    sendResult(callId, ok, result, error) {
      this.session.sendOneShot({
        type: "miniapp_action_result" /* ACTION_RESULT */,
        callId,
        ok,
        ...ok ? { result } : { error }
      });
    }
  }

  // vendor/mentra-miniapp/src/modules/blob.ts
  var BLOB_WRITE_CHUNK_BYTES = 1024 * 1024;
  var BLOB_WRITE_CHUNK_B64 = Math.floor(BLOB_WRITE_CHUNK_BYTES / 3) * 4;
  var BLOB_READ_ALL_MAX_BYTES = 32 * 1024 * 1024;

  class BlobWriter {
    session;
    key;
    settled = false;
    constructor(session, key) {
      this.session = session;
      this.key = key;
    }
    async write(chunk) {
      this.assertOpen();
      const bytes = toUint8Array(chunk);
      for (let off = 0;off < bytes.length; off += BLOB_WRITE_CHUNK_BYTES) {
        await this.send(bytesToBase64(bytes.subarray(off, off + BLOB_WRITE_CHUNK_BYTES)));
      }
    }
    async writeBase64(b64) {
      this.assertOpen();
      for (let off = 0;off < b64.length; off += BLOB_WRITE_CHUNK_B64) {
        await this.send(b64.slice(off, off + BLOB_WRITE_CHUNK_B64));
      }
    }
    async writeAt(offset, chunk) {
      this.assertOpen();
      await this.session.sendRequest({
        type: "miniapp_blob_write" /* BLOB_WRITE */,
        key: this.key,
        offset,
        base64: bytesToBase64(toUint8Array(chunk))
      });
    }
    async close(meta) {
      this.assertOpen();
      this.settled = true;
      return this.session.sendRequest({ type: "miniapp_blob_commit" /* BLOB_COMMIT */, key: this.key, meta });
    }
    async abort() {
      if (this.settled)
        return;
      this.settled = true;
      await this.session.sendRequest({ type: "miniapp_blob_abort" /* BLOB_ABORT */, key: this.key });
    }
    assertOpen() {
      if (this.settled)
        throw new Error("BlobWriter is already closed/aborted");
    }
    send(base64) {
      return this.session.sendRequest({
        type: "miniapp_blob_write" /* BLOB_WRITE */,
        key: this.key,
        base64
      });
    }
  }

  class BlobReader {
    session;
    handle;
    meta;
    closed = false;
    constructor(session, handle, meta) {
      this.session = session;
      this.handle = handle;
      this.meta = meta;
    }
    async read(maxBytes = BLOB_WRITE_CHUNK_BYTES) {
      if (this.closed)
        throw new Error("BlobReader is closed");
      const res = await this.session.sendRequest({
        type: "miniapp_blob_read" /* BLOB_READ */,
        handle: this.handle,
        maxBytes
      });
      return { bytes: base64ToBytes(res?.base64 ?? ""), done: !!res?.done };
    }
    async close() {
      if (this.closed)
        return;
      this.closed = true;
      await this.session.sendRequest({ type: "miniapp_blob_close_read" /* BLOB_CLOSE_READ */, handle: this.handle });
    }
  }

  class BlobModule {
    session;
    constructor(session) {
      this.session = session;
    }
    async set(key, data, opts = {}) {
      const writer = await this.createWriteStream(key, opts);
      try {
        if (typeof data === "string")
          await writer.writeBase64(data);
        else
          await writer.write(data);
        return await writer.close();
      } catch (err) {
        await writer.abort().catch(() => {});
        throw err;
      }
    }
    setFromUrl(key, url, opts = {}) {
      return this.session.sendRequest({
        type: "miniapp_blob_set_from_url" /* BLOB_SET_FROM_URL */,
        key,
        url,
        mimeType: opts.mimeType,
        name: opts.name,
        headers: opts.headers,
        meta: opts.meta
      });
    }
    importFile(opts = {}) {
      return this.session.sendRequest({
        type: "miniapp_blob_import" /* BLOB_IMPORT */,
        key: opts.key,
        mimeType: opts.mimeType,
        meta: opts.meta
      });
    }
    async createWriteStream(key, opts = {}) {
      const res = await this.session.sendRequest({
        type: "miniapp_blob_create" /* BLOB_CREATE */,
        key,
        mimeType: opts.mimeType,
        name: opts.name,
        meta: opts.meta
      });
      return new BlobWriter(this.session, res.key);
    }
    get(key) {
      return this.session.sendRequest({ type: "miniapp_blob_get" /* BLOB_GET */, key });
    }
    stat(key) {
      return this.get(key);
    }
    async has(key) {
      return await this.get(key) !== null;
    }
    async keys() {
      return (await this.list()).map((m) => m.key);
    }
    async list() {
      const res = await this.session.sendRequest({ type: "miniapp_blob_list" /* BLOB_LIST */ });
      return res?.blobs ?? [];
    }
    async createReadStream(key) {
      const res = await this.session.sendRequest({
        type: "miniapp_blob_open_read" /* BLOB_OPEN_READ */,
        key
      });
      return new BlobReader(this.session, res.handle, res.meta);
    }
    async bytes(key) {
      let reader;
      try {
        reader = await this.createReadStream(key);
      } catch {
        return null;
      }
      const parts = [];
      let total = 0;
      try {
        for (;; ) {
          const { bytes, done } = await reader.read();
          if (bytes.length) {
            total += bytes.length;
            if (total > BLOB_READ_ALL_MAX_BYTES) {
              throw new Error(`Blob "${key}" exceeds the in-memory read cap — stream it with createReadStream()`);
            }
            parts.push(bytes);
          }
          if (done)
            break;
        }
      } finally {
        await reader.close().catch(() => {});
      }
      const out = new Uint8Array(total);
      let at = 0;
      for (const p of parts) {
        out.set(p, at);
        at += p.length;
      }
      return out;
    }
    usage() {
      return this.session.sendRequest({
        type: "miniapp_blob_usage" /* BLOB_USAGE */
      });
    }
    async delete(key) {
      await this.session.sendRequest({ type: "miniapp_blob_delete" /* BLOB_DELETE */, key });
    }
    async clear() {
      await this.session.sendRequest({ type: "miniapp_blob_clear" /* BLOB_CLEAR */ });
    }
    async share(key) {
      const res = await this.session.sendRequest({
        type: "miniapp_blob_share" /* BLOB_SHARE */,
        key
      });
      return res ?? { success: false };
    }
  }

  // vendor/mentra-miniapp/src/modules/meeting.ts
  var MEETING_HOST_UPDATE_MESSAGE = "Update the Mentra App to use Teams calling";
  function validateMeetingVideoSource(source) {
    const value = source ?? {};
    if (value.type === "whep") {
      const url = typeof value.url === "string" ? value.url.trim() : "";
      if (!url) {
        throw { code: "INVALID_ARGUMENT" /* INVALID_ARGUMENT */, message: "videoSource.url is required for a WHEP source" };
      }
      return { type: "whep", url };
    }
    if (value.type === "softap") {
      const ssid = typeof value.ssid === "string" ? value.ssid.trim() : "";
      const passphrase = typeof value.passphrase === "string" ? value.passphrase : "";
      if (Boolean(ssid) !== Boolean(passphrase)) {
        throw {
          code: "INVALID_ARGUMENT" /* INVALID_ARGUMENT */,
          message: "videoSource.ssid and videoSource.passphrase must be provided together"
        };
      }
      return ssid ? { type: "softap", ssid, passphrase } : { type: "softap" };
    }
    throw {
      code: "INVALID_ARGUMENT" /* INVALID_ARGUMENT */,
      message: `videoSource must be {type: "whep", url} or {type: "softap"}`
    };
  }
  function parseMeetingEndReason(raw) {
    if (!raw || typeof raw !== "object")
      return;
    const value = raw;
    const number = (field) => typeof field === "number" && Number.isFinite(field) ? field : undefined;
    const code = number(value.code);
    const subcode = number(value.subcode);
    const message = typeof value.message === "string" && value.message ? value.message : undefined;
    if (code === undefined && subcode === undefined && message === undefined)
      return;
    return {
      ...code !== undefined ? { code } : {},
      ...subcode !== undefined ? { subcode } : {},
      ...message !== undefined ? { message } : {}
    };
  }
  function parseMeetingCapabilities(raw) {
    if (!raw || typeof raw !== "object")
      return;
    const value = raw.hangUpForEveryone;
    if (!value || typeof value !== "object")
      return;
    const capability = value;
    const rawLobby = raw.manageLobby;
    const lobby = rawLobby && typeof rawLobby === "object" ? rawLobby : undefined;
    return {
      ...lobby ? {
        manageLobby: {
          allowed: typeof lobby.allowed === "boolean" ? lobby.allowed : null,
          reason: typeof lobby.reason === "string" && lobby.reason ? lobby.reason : null
        }
      } : {},
      hangUpForEveryone: {
        allowed: typeof capability.allowed === "boolean" ? capability.allowed : null,
        reason: typeof capability.reason === "string" && capability.reason ? capability.reason : null
      }
    };
  }
  var SOFTAP_STEPS = new Set(["hotspot", "scopedJoin", "acsJoin", "publish", "live"]);
  var SOFTAP_STEP_STATUSES = new Set(["pending", "running", "done", "failed"]);
  var SOFTAP_PHASES = new Set(["idle", "starting", "recovering", "live", "stopping", "failed"]);
  function parseMeetingSoftApProgress(raw) {
    if (!raw || typeof raw !== "object")
      return;
    const value = raw;
    if (!SOFTAP_PHASES.has(String(value.phase)) || !Array.isArray(value.steps))
      return;
    const steps = [];
    for (const entry of value.steps) {
      if (!entry || typeof entry !== "object")
        continue;
      const step = entry;
      if (!SOFTAP_STEPS.has(String(step.step)) || !SOFTAP_STEP_STATUSES.has(String(step.status)))
        continue;
      steps.push({
        step: step.step,
        status: step.status,
        detail: typeof step.detail === "string" && step.detail ? step.detail : undefined,
        error: typeof step.error === "string" && step.error ? step.error : undefined,
        durationMs: typeof step.durationMs === "number" && Number.isFinite(step.durationMs) ? step.durationMs : undefined
      });
    }
    return {
      traceId: typeof value.traceId === "string" && value.traceId ? value.traceId : undefined,
      phase: value.phase,
      steps,
      elapsedMs: typeof value.elapsedMs === "number" && Number.isFinite(value.elapsedMs) ? value.elapsedMs : 0
    };
  }
  function parseMeetingRecovery(raw) {
    if (!raw || typeof raw !== "object")
      return;
    const value = raw;
    if (typeof value.active !== "boolean")
      return;
    const generation = typeof value.generation === "number" && Number.isFinite(value.generation) ? value.generation : undefined;
    const deadlineAt = typeof value.deadlineAt === "number" && Number.isFinite(value.deadlineAt) ? value.deadlineAt : undefined;
    const phase = typeof value.phase === "string" && value.phase ? value.phase : undefined;
    return {
      active: value.active,
      ...generation !== undefined ? { generation } : {},
      ...deadlineAt !== undefined ? { deadlineAt } : {},
      ...phase ? { phase } : {}
    };
  }
  var PARTICIPANT_STATES = new Set([
    "idle",
    "connecting",
    "connected",
    "lobby",
    "hold",
    "disconnected"
  ]);
  var MEDIA_SOURCES = new Set(["idle", "connecting", "live", "failed"]);
  function parseMeetingMediaSource(raw) {
    return MEDIA_SOURCES.has(String(raw)) ? raw : undefined;
  }
  function parseMeetingParticipants(raw) {
    if (!Array.isArray(raw))
      return;
    const result = [];
    for (const entry of raw) {
      if (!entry || typeof entry !== "object")
        continue;
      const value = entry;
      if (typeof value.id !== "string" || !value.id)
        continue;
      result.push({
        id: value.id,
        displayName: typeof value.displayName === "string" && value.displayName ? value.displayName : null,
        state: PARTICIPANT_STATES.has(String(value.state)) ? value.state : "idle",
        isMuted: Boolean(value.isMuted),
        isSpeaking: Boolean(value.isSpeaking)
      });
    }
    return result;
  }
  function isMiniappRequestError(error) {
    return Boolean(error && typeof error === "object" && "code" in error);
  }
  function mapHostError(error) {
    if (isMiniappRequestError(error) && error.code === "NOT_IMPLEMENTED" /* NOT_IMPLEMENTED */) {
      throw { code: "NOT_IMPLEMENTED" /* NOT_IMPLEMENTED */, message: MEETING_HOST_UPDATE_MESSAGE };
    }
    throw error;
  }

  class MeetingModule {
    session;
    _state = { state: "idle", muted: false };
    constructor(session) {
      this.session = session;
    }
    get state() {
      return { ...this._state };
    }
    async join(options) {
      if (options.provider !== "acs-teams") {
        throw { code: "INVALID_ARGUMENT" /* INVALID_ARGUMENT */, message: `Unsupported meeting provider: ${options.provider}` };
      }
      if (!options.meetingUrl?.trim()) {
        throw { code: "INVALID_ARGUMENT" /* INVALID_ARGUMENT */, message: "meetingUrl is required" };
      }
      const videoSource = validateMeetingVideoSource(options.videoSource);
      try {
        const result = await this.session.sendRequest({
          type: "miniapp_meeting_join" /* MEETING_JOIN */,
          provider: options.provider,
          meetingUrl: options.meetingUrl,
          videoSource,
          ...options.token ? { token: options.token } : {},
          displayName: options.displayName,
          ...options.origin ? { origin: options.origin } : {},
          ...options.video ? { video: options.video } : {}
        }, { timeoutMs: 0 });
        if (result)
          this._applyState(result);
        return this.state;
      } catch (error) {
        mapHostError(error);
      }
    }
    async getConfiguration() {
      return this.session.sendRequest({ type: "miniapp_meeting_get_configuration" /* MEETING_GET_CONFIGURATION */ });
    }
    async getIdentity() {
      try {
        return await this.session.sendRequest({ type: "miniapp_meeting_get_identity" /* MEETING_GET_IDENTITY */ }, { timeoutMs: 30000 });
      } catch (error) {
        mapHostError(error);
      }
    }
    async create(options) {
      if (options.provider !== "acs-teams") {
        throw { code: "INVALID_ARGUMENT" /* INVALID_ARGUMENT */, message: "Unsupported meeting provider" };
      }
      try {
        return await this.session.sendRequest({
          type: "miniapp_meeting_create" /* MEETING_CREATE */,
          provider: options.provider,
          subject: options.subject,
          durationMinutes: options.durationMinutes
        }, { timeoutMs: 0 });
      } catch (error) {
        mapHostError(error);
      }
    }
    async retire(meetingRef) {
      try {
        await this.session.sendRequest({ type: "miniapp_meeting_retire" /* MEETING_RETIRE */, meetingRef }, { timeoutMs: 0 });
      } catch (error) {
        mapHostError(error);
      }
    }
    async leave() {
      try {
        await this.session.sendRequest({ type: "miniapp_meeting_leave" /* MEETING_LEAVE */ });
      } catch (error) {
        mapHostError(error);
      }
    }
    async end() {
      try {
        await this.session.sendRequest({ type: "miniapp_meeting_end" /* MEETING_END */ }, { timeoutMs: 0 });
      } catch (error) {
        mapHostError(error);
      }
    }
    async admit(participantId) {
      if (!participantId.trim())
        throw new Error("A participant ID is required");
      try {
        await this.session.sendRequest({ type: "miniapp_meeting_admit" /* MEETING_ADMIT */, participantId });
      } catch (error) {
        mapHostError(error);
      }
    }
    async setMuted(muted) {
      try {
        const result = await this.session.sendRequest({
          type: "miniapp_meeting_set_muted" /* MEETING_SET_MUTED */,
          muted
        });
        if (result)
          this._applyState(result);
      } catch (error) {
        mapHostError(error);
      }
    }
    async setVideoEnabled(enabled) {
      try {
        const result = await this.session.sendRequest({
          type: "miniapp_meeting_set_video_enabled" /* MEETING_SET_VIDEO_ENABLED */,
          enabled
        });
        if (result)
          this._applyState(result);
      } catch (error) {
        mapHostError(error);
      }
    }
    async updateVideoSource(source) {
      const validated = validateMeetingVideoSource(source);
      if (validated.type !== "whep") {
        throw {
          code: "INVALID_ARGUMENT" /* INVALID_ARGUMENT */,
          message: "updateVideoSource accepts a WHEP source; a SoftAP call recovers by rejoining"
        };
      }
      try {
        await this.session.sendRequest({
          type: "miniapp_meeting_update_video_source" /* MEETING_UPDATE_VIDEO_SOURCE */,
          videoSource: validated
        });
      } catch (error) {
        mapHostError(error);
      }
    }
    async getState() {
      try {
        const result = await this.session.sendRequest({
          type: "miniapp_meeting_get_state" /* MEETING_GET_STATE */
        });
        if (result)
          this._applyState(result);
        return this.state;
      } catch (error) {
        mapHostError(error);
      }
    }
    onState(handler) {
      return this.session.on("meetingState", handler);
    }
    _applyState(event) {
      this._state = {
        identityMode: event.identityMode === "guest" || event.identityMode === "teams-user" ? event.identityMode : undefined,
        guestReason: event.identityMode === "guest" ? event.guestReason : undefined,
        state: event.state,
        muted: Boolean(event.muted),
        videoEnabled: typeof event.videoEnabled === "boolean" ? event.videoEnabled : undefined,
        error: event.error,
        endReason: parseMeetingEndReason(event.endReason),
        meetingUrl: event.meetingUrl,
        provider: event.provider,
        audioSource: event.audioSource,
        audioSourceReason: event.audioSourceReason,
        activeStream: event.activeStream,
        audioSafety: event.audioSafety,
        mediaSource: parseMeetingMediaSource(event.mediaSource),
        participants: parseMeetingParticipants(event.participants),
        capabilities: parseMeetingCapabilities(event.capabilities) ?? this._state.capabilities,
        softap: parseMeetingSoftApProgress(event.softap),
        recovery: parseMeetingRecovery(event.recovery) ?? this._state.recovery
      };
    }
  }

  // vendor/mentra-miniapp/src/session.ts
  var ALL_PERMISSION_TYPES = [
    "location",
    "microphone",
    "camera",
    "notifications",
    "calendar"
  ];

  class NotConnectedError extends Error {
    code = "NOT_CONNECTED" /* NOT_CONNECTED */;
    constructor(message = "MiniappSession is not connected") {
      super(message);
      this.name = "NotConnectedError";
    }
  }
  var DEFAULT_CONNECT_TIMEOUT_MS = 1e4;
  var DEFAULT_REQUEST_TIMEOUT_MS = 60000;

  class MiniappSession {
    auth;
    configuration;
    display;
    events;
    speaker;
    meeting;
    camera;
    cloud;
    dashboard;
    glasses;
    heading;
    imu;
    input;
    led;
    location;
    mic;
    navigation;
    permissions;
    phone;
    storage;
    blob;
    stream;
    system;
    transcription;
    translation;
    ui;
    miniapps;
    actions;
    capabilities = null;
    hostFeatures = null;
    userId = "";
    packageName = "";
    visibility = "foreground";
    colorScheme = "light";
    ready = false;
    transport;
    connectTimeoutMs;
    emitter = new import__.default;
    authState = null;
    configurationState = {};
    authWaiters = new Set;
    authRefreshPromise = null;
    outboundQueue = [];
    pendingRequests = new Map;
    connectPromise = null;
    disposed = false;
    _permissions = {
      location: false,
      microphone: false,
      camera: false,
      notifications: false,
      calendar: false
    };
    constructor(options = {}) {
      this.transport = createTransport(options);
      this.connectTimeoutMs = options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
      const injected = getMentraOSGlobals();
      this.packageName = options.packageName ?? injected.packageName ?? "";
      if (injected.colorScheme === "light" || injected.colorScheme === "dark") {
        this.colorScheme = injected.colorScheme;
      }
      this.auth = new AuthModule(this);
      this.configuration = new ConfigurationModule(this);
      this.events = new EventManager(this);
      this.speaker = new SpeakerModule(this);
      this.meeting = new MeetingModule(this);
      this.camera = new CameraModule(this);
      this.cloud = new CloudModule(this);
      this.dashboard = new DashboardAPI(this);
      this.display = new DisplayManager(this);
      this.glasses = new GlassesModule(this);
      this.heading = new HeadingModule(this);
      this.imu = new ImuModule(this);
      this.input = new InputModule(this);
      this.led = new LedModule(this);
      this.location = new LocationModule(this);
      this.mic = new MicModule(this);
      this.navigation = new NavigationModule(this);
      this.permissions = new PermissionsModule(this);
      this.phone = new PhoneModule(this);
      this.storage = new SimpleStorage(this);
      this.blob = new BlobModule(this);
      this.stream = new StreamModule(this);
      this.system = new SystemModule(this);
      this.transcription = new TranscriptionModule(this);
      this.translation = new TranslationModule(this);
      this.ui = new UIModuleImpl(this);
      this.miniapps = new MiniappsModule(this);
      this.actions = new ActionsModule(this);
    }
    _hasManifestPermission(manifestKey) {
      const canonical = manifestKeyToCanonical(manifestKey);
      if (!canonical)
        return false;
      return this._permissions[canonical] === true;
    }
    _getPermissions() {
      return { ...this._permissions };
    }
    _getAuth() {
      return this.authState ? { ...this.authState } : null;
    }
    _getConfiguration() {
      return { ...this.configurationState };
    }
    _waitForAuth(minTtlMs, timeoutMs = 1e4) {
      const current = this.authState;
      if (current && this.authHasTtl(current, minTtlMs)) {
        return Promise.resolve({ ...current });
      }
      this.requestAuthRefresh(minTtlMs);
      return new Promise((resolve, reject) => {
        const waiter = {
          minTtlMs,
          resolve,
          reject,
          timer: setTimeout(() => {
            this.authWaiters.delete(waiter);
            reject(new NotConnectedError("Miniapp auth token is not available"));
          }, timeoutMs)
        };
        this.authWaiters.add(waiter);
      });
    }
    _subscribe(streamType, handler, options = {}) {
      return this.events.subscribe(streamType, handler, options);
    }
    connect() {
      if (this.disposed) {
        return Promise.reject(new NotConnectedError("MiniappSession was disposed"));
      }
      if (this.connectPromise)
        return this.connectPromise;
      const readyPromise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          const err = new Error("MiniappSession: CONNECT_ACK timeout");
          this.failAllPending({ code: "NOT_CONNECTED" /* NOT_CONNECTED */, message: err.message });
          this.emitter.emit("error", err);
          reject(err);
        }, this.connectTimeoutMs);
        this.emitter.once("ready", () => {
          clearTimeout(timer);
          resolve();
        });
        this.emitter.once("error", (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });
      this.connectPromise = (async () => {
        this.transport.onMessage((raw) => this.handleIncoming(raw));
        this.transport.onDisconnect((reason) => this.handleTransportDisconnect(reason));
        await this.transport.open();
        const requestId = makeRequestId();
        const connectPayload = {
          type: "miniapp_connect" /* CONNECT */,
          packageName: this.packageName
        };
        this.transport.send(serializeEnvelope({ payload: connectPayload, requestId }));
        await readyPromise;
      })();
      return this.connectPromise;
    }
    waitForReady() {
      if (this.ready)
        return Promise.resolve();
      return this.connect();
    }
    isConnected() {
      return this.ready && this.transport.isOpen();
    }
    disconnect() {
      if (this.disposed)
        return;
      this.disposed = true;
      try {
        this.emitter.emit("beforeDisconnect", "disconnect called");
      } catch (err) {
        console.warn("[MiniappSession] beforeDisconnect handler threw:", err);
      }
      this.failAllPending({ code: "REQUEST_ABORTED" /* REQUEST_ABORTED */, message: "Session disconnected" });
      try {
        this.transport.close();
      } catch {}
      this.ready = false;
      this.emitter.emit("disconnect", "disconnect called");
    }
    sendOneShot(payload) {
      const envelope = { payload };
      this.enqueueOrSend(serializeEnvelope(envelope));
    }
    sendRequest(payload, opts) {
      if (this.disposed) {
        return Promise.reject(new NotConnectedError);
      }
      const requestId = makeRequestId();
      const envelope = { payload, requestId };
      const timeoutMs = opts?.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
      return new Promise((resolve, reject) => {
        const timer = timeoutMs > 0 ? setTimeout(() => {
          const pending = this.pendingRequests.get(requestId);
          if (!pending)
            return;
          this.pendingRequests.delete(requestId);
          pending.reject({
            code: "ACTION_TIMEOUT" /* ACTION_TIMEOUT */,
            message: "Request timed out waiting for a response from the host"
          });
        }, timeoutMs) : undefined;
        this.pendingRequests.set(requestId, {
          requestId,
          resolve,
          reject,
          timer
        });
        this.enqueueOrSend(serializeEnvelope(envelope));
      });
    }
    on(event, handler) {
      this.emitter.on(event, handler);
      return () => this.emitter.off(event, handler);
    }
    off(event, handler) {
      this.emitter.off(event, handler);
    }
    onBeforeDisconnect(handler) {
      return this.on("beforeDisconnect", handler);
    }
    onVisibilityChange(handler) {
      return this.on("visibility", handler);
    }
    onCapabilitiesChange(handler) {
      return this.on("capabilities", handler);
    }
    onColorSchemeChange(handler) {
      return this.on("colorScheme", handler);
    }
    enqueueOrSend(raw) {
      if (this.ready) {
        try {
          this.transport.send(raw);
        } catch (err) {
          this.emitter.emit("error", err);
        }
        return;
      }
      this.outboundQueue.push(raw);
    }
    flushQueue() {
      const queue = this.outboundQueue.splice(0);
      for (const raw of queue) {
        try {
          this.transport.send(raw);
        } catch (err) {
          this.emitter.emit("error", err);
        }
      }
    }
    handleIncoming(raw) {
      const envelope = parseEnvelope(raw);
      if (!envelope)
        return;
      const payload = envelope.payload;
      const type = payload?.type;
      switch (type) {
        case "miniapp_connect_ack" /* CONNECT_ACK */: {
          const ack = payload;
          this.userId = ack.userId ?? "";
          if (ack.packageName)
            this.packageName = ack.packageName;
          this.capabilities = ack.capabilities ?? null;
          this.hostFeatures = ack.hostFeatures ?? null;
          if (ack.visibility)
            this.visibility = ack.visibility;
          if (ack.colorScheme === "light" || ack.colorScheme === "dark") {
            this.colorScheme = ack.colorScheme;
          }
          if (ack.auth) {
            this.applyAuth(ack.auth);
            if (!this.userId)
              this.userId = ack.auth.mentraUserId;
          }
          this.configurationState = Object.freeze({ ...ack.configuration });
          if (ack.permissions)
            this.applyPermissions(ack.permissions);
          this.ready = true;
          this.flushQueue();
          this.emitter.emit("ready");
          return;
        }
        case "miniapp_auth_update" /* AUTH_UPDATE */: {
          const next = payload.auth;
          if (next) {
            this.applyAuth(next);
            if (!this.userId)
              this.userId = next.mentraUserId;
          }
          return;
        }
        case "miniapp_permissions_update" /* PERMISSIONS_UPDATE */: {
          const next = payload.permissions;
          if (next)
            this.applyPermissions(next);
          return;
        }
        case "miniapp_speaker_state" /* SPEAKER_STATE */: {
          const state = payload.state;
          if (!state)
            return;
          const event = {
            state,
            errorCode: payload.errorCode,
            errorMessage: payload.errorMessage,
            durationMs: payload.durationMs
          };
          this.speaker._applyState(event);
          this.emitter.emit("speakerState", event);
          return;
        }
        case "miniapp_meeting_state" /* MEETING_STATE */: {
          const state = payload.state;
          if (!state)
            return;
          const event = {
            state,
            muted: Boolean(payload.muted),
            videoEnabled: typeof payload.videoEnabled === "boolean" ? payload.videoEnabled : undefined,
            error: payload.error,
            meetingUrl: payload.meetingUrl,
            provider: payload.provider,
            audioSource: payload.audioSource,
            audioSourceReason: payload.audioSourceReason,
            activeStream: payload.activeStream,
            audioSafety: payload.audioSafety,
            mediaSource: parseMeetingMediaSource(payload.mediaSource),
            endReason: parseMeetingEndReason(payload.endReason),
            participants: parseMeetingParticipants(payload.participants),
            capabilities: parseMeetingCapabilities(payload.capabilities),
            softap: parseMeetingSoftApProgress(payload.softap),
            recovery: parseMeetingRecovery(payload.recovery)
          };
          this.meeting._applyState(event);
          this.emitter.emit("meetingState", event);
          return;
        }
        case "miniapp_stream_preview_status" /* STREAM_PREVIEW_STATUS */: {
          this.stream._applyPreviewStatus(payload);
          return;
        }
        case "miniapp_ping" /* PING */: {
          const pong = { type: "miniapp_pong" /* PONG */ };
          const env = {
            payload: pong,
            ...envelope.requestId ? { requestId: envelope.requestId } : {}
          };
          try {
            this.transport.send(serializeEnvelope(env));
          } catch {}
          return;
        }
        case "miniapp_event" /* EVENT */: {
          const streamType = payload.streamType;
          if (!streamType)
            return;
          this.events._forwardEvent(streamType, payload.data, payload.transcriptionRoute);
          return;
        }
        case "miniapp_action_call" /* ACTION_CALL */: {
          const callId = payload.callId;
          const actionId = payload.actionId;
          if (!callId || !actionId)
            return;
          const params = payload.params ?? {};
          const callerPackageName = payload.callerPackageName ?? "";
          this.actions._deliver(callId, actionId, params, { callerPackageName });
          return;
        }
        case "miniapp_capabilities_update" /* CAPABILITIES_UPDATE */: {
          const cap = payload.capabilities ?? null;
          this.capabilities = cap;
          this.emitter.emit("capabilities", cap);
          return;
        }
        case "miniapp_visibility_change" /* VISIBILITY_CHANGE */: {
          const next = payload.visibility;
          if (next === "foreground" || next === "background") {
            this.visibility = next;
            this.emitter.emit("visibility", next);
          }
          return;
        }
        case "miniapp_color_scheme_change" /* COLOR_SCHEME_CHANGE */: {
          const next = payload.colorScheme;
          if (next === "light" || next === "dark") {
            this.colorScheme = next;
            this.emitter.emit("colorScheme", next);
          }
          return;
        }
        case "miniapp_request_result" /* REQUEST_RESULT */: {
          const requestId = envelope.requestId;
          if (!requestId)
            return;
          const pending = this.pendingRequests.get(requestId);
          if (!pending)
            return;
          this.pendingRequests.delete(requestId);
          if (pending.timer)
            clearTimeout(pending.timer);
          if (payload.ok === false) {
            const err = payload.error ?? {
              code: "INTERNAL" /* INTERNAL */,
              message: "Unknown error"
            };
            pending.reject(err);
          } else {
            pending.resolve(payload.data ?? null);
          }
          return;
        }
        case "miniapp_will_disconnect" /* WILL_DISCONNECT */: {
          const reason = payload.reason ?? "phone unregistering";
          try {
            this.emitter.emit("beforeDisconnect", reason);
          } catch (err) {
            console.warn("[MiniappSession] beforeDisconnect handler threw:", err);
          }
          return;
        }
        case "miniapp_error" /* ERROR */: {
          const err = new Error(payload.message ?? "MiniappSession error");
          this.emitter.emit("error", err);
          return;
        }
        default:
          return;
      }
    }
    handleTransportDisconnect(reason) {
      this.ready = false;
      this.failAllPending({ code: "NOT_CONNECTED" /* NOT_CONNECTED */, message: `Transport disconnected: ${reason}` });
      this.emitter.emit("disconnect", reason);
    }
    failAllPending(error) {
      for (const pending of this.pendingRequests.values()) {
        if (pending.timer)
          clearTimeout(pending.timer);
        pending.reject(error);
      }
      this.pendingRequests.clear();
      for (const waiter of Array.from(this.authWaiters)) {
        clearTimeout(waiter.timer);
        this.authWaiters.delete(waiter);
        waiter.reject(new NotConnectedError(error.message));
      }
    }
    authHasTtl(auth, minTtlMs) {
      return auth.expiresAt - Date.now() > minTtlMs;
    }
    requestAuthRefresh(minTtlMs) {
      if (this.authRefreshPromise)
        return this.authRefreshPromise;
      if (!this.ready || !this.transport.isOpen())
        return Promise.resolve(null);
      this.authRefreshPromise = this.sendRequest({
        type: "miniapp_auth_refresh" /* AUTH_REFRESH */,
        minTtlMs
      }).then((result) => {
        const auth = result?.auth;
        if (auth)
          this.applyAuth(auth);
        return auth ?? null;
      }).catch((err) => {
        console.warn("[MiniappSession] auth refresh failed:", err);
        return null;
      }).finally(() => {
        this.authRefreshPromise = null;
      });
      return this.authRefreshPromise;
    }
    applyAuth(next) {
      this.authState = { ...next };
      for (const waiter of Array.from(this.authWaiters)) {
        if (!this.authHasTtl(next, waiter.minTtlMs))
          continue;
        clearTimeout(waiter.timer);
        this.authWaiters.delete(waiter);
        waiter.resolve({ ...next });
      }
      this.emitter.emit("auth", { ...next });
    }
    applyPermissions(next) {
      let changed = false;
      const updated = { ...this._permissions };
      for (const k of ALL_PERMISSION_TYPES) {
        const v = next[k] === true;
        if (updated[k] !== v) {
          updated[k] = v;
          changed = true;
        }
      }
      if (changed) {
        this._permissions = updated;
        this.emitter.emit("permissions", { ...updated });
      }
    }
  }
  function manifestKeyToCanonical(manifestKey) {
    switch (manifestKey.toUpperCase()) {
      case "MICROPHONE":
        return "microphone";
      case "CAMERA":
        return "camera";
      case "LOCATION":
      case "BACKGROUND_LOCATION":
        return "location";
      case "READ_NOTIFICATIONS":
      case "POST_NOTIFICATIONS":
        return "notifications";
      case "CALENDAR":
        return "calendar";
      default:
        return null;
    }
  }

  // vendor/mentra-miniapp/src/background/register.ts
  function registerMiniapp(handler, options = {}) {
    const g = globalThis;
    g.__mentraInitCallback = (_sessionId) => {
      const session = new MiniappSession(options);
      try {
        const result = handler(session);
        if (result && typeof result.then === "function") {
          result.catch((err) => {
            console.error("[mentra-miniapp] registerMiniapp handler rejected:", err);
          });
        }
      } catch (err) {
        console.error("[mentra-miniapp] registerMiniapp handler threw:", err);
      }
      session.connect().catch((err) => {
        console.error("[mentra-miniapp] session.connect() rejected:", err);
        try {
          const message = err instanceof Error ? err.message : String(err);
          const stack = err instanceof Error && err.stack ? err.stack : "";
          g.__hostError?.(JSON.stringify({ message: `session.connect() failed: ${message}`, stack }));
        } catch {}
      });
    };
  }
  // src/background/glyphs.ts
  var G1_GLYPH_PX = { " ": 6, "!": 4, '"': 6, "#": 14, $: 12, "%": 14, "&": 16, "'": 4, "(": 6, ")": 6, "*": 8, "+": 10, ",": 4, "-": 10, ".": 4, "/": 8, "0": 12, "1": 8, "2": 12, "3": 12, "4": 12, "5": 12, "6": 12, "7": 12, "8": 12, "9": 12, ":": 4, ";": 4, "<": 10, "=": 10, ">": 10, "?": 12, "@": 16, A: 14, B: 12, C: 12, D: 12, E: 10, F: 10, G: 12, H: 12, I: 6, J: 8, K: 12, L: 10, M: 16, N: 12, O: 12, P: 12, Q: 12, R: 12, S: 12, T: 12, U: 12, V: 14, W: 16, X: 14, Y: 14, Z: 12, "[": 6, "\\": 8, "]": 6, "^": 10, _: 8, "`": 6, a: 12, b: 10, c: 10, d: 10, e: 10, f: 10, g: 10, h: 10, i: 4, j: 6, k: 10, l: 4, m: 16, n: 10, o: 10, p: 10, q: 10, r: 8, s: 10, t: 8, u: 12, v: 12, w: 16, x: 12, y: 12, z: 10, "{": 8, "|": 4, "}": 8, "~": 16, "À": 16, "Â": 16, "Ç": 16, "È": 16, "É": 16, "Ê": 16, "Ë": 16, "Î": 16, "Ï": 16, "Ô": 16, "Ù": 16, "Û": 16, "Ü": 16, "à": 16, "ç": 16, "è": 16, "é": 16, "ê": 16, "ë": 16, "î": 16, "ï": 16, "ô": 16, "ù": 16, "û": 16, "ü": 16, "ÿ": 16, "Ÿ": 16, "Ä": 16, "ä": 16, "Ö": 16, "ö": 16, "ß": 16, "ẞ": 16, "â": 16, "Á": 16, "á": 16, "Í": 16, "í": 16, "Ñ": 16, "ñ": 16, "ú": 16, "Ó": 16, "ó": 16, "Ú": 16, "…": 16, "·": 16, "•": 16, "–": 16, "—": 16, "“": 16, "”": 16, "‘": 16, "’": 16, "‹": 16, "›": 16, "⁄": 16, "½": 16, "¼": 16, "¾": 16, "⅛": 16, "⅜": 16, "⅝": 16, "⅞": 16, "₀": 16, "₁": 16, "₂": 16, "₃": 16, "₄": 16, "₅": 16, "₆": 16, "₇": 16, "₈": 16, "₉": 16, "⁰": 16, "ⁱ": 16, "⁲": 16, "⁳": 16, "⁴": 16, "⁵": 16, "⁶": 16, "⁷": 16, "⁸": 16, "⁹": 16, "¿": 16, "‚": 16, "„": 16, "«": 16, "»": 16, "฿": 16, "¶": 16, "§": 16, "©": 18, "®": 16, "™": 16, "°": 16, "¦": 16, "†": 16, "‡": 16, "€": 16, "₿": 16, "¢": 16, "£": 16, "¥": 16, "−": 16, "×": 16, "÷": 16, "≠": 16, "≥": 16, "≤": 16, "±": 16, "≈": 16, "¬": 16, "∞": 18, "∫": 16, "∏": 16, "∑": 16, "√": 16, "∂": 16, "‰": 16, "↑": 16, "↗": 16, "→": 16, "↘": 16, "↓": 16, "↙": 16, "←": 16, "↖": 16, "↔": 18, "↕": 16, "◌": 20, "◊": 16, "¨": 16, "˙": 16, "´": 16, "˝": 16, "ˆ": 16, "ˇ": 16, "˘": 16, "˚": 16, "˜": 16, "¯": 16, "¸": 16, "˛": 16, "Ĳ": 16, "ĳ": 16, "Š": 16, "š": 16, "Ž": 16, "ž": 16, "Ã": 16, "Å": 16, "Æ": 18, "Ì": 16, "Ð": 16, "Ò": 16, "Õ": 16, "Ø": 16, "Ý": 16, "Þ": 16, "ã": 16, "å": 16, "æ": 18, "ì": 16, "ð": 16, "ò": 16, "õ": 16, "ø": 16, "ý": 16, "þ": 16, "Ą": 16, "ą": 16, "Ć": 16, "ć": 16, "Č": 16, "č": 16, "Ď": 16, "ď": 16, "Ę": 16, "ę": 16, "Ě": 16, "ě": 16, "Ğ": 16, "ğ": 16, "Ł": 16, "ł": 16, "Ń": 16, "ń": 16, "Ň": 16, "ň": 16, "Ř": 16, "ř": 16, "Ś": 16, "ś": 16, "Ş": 16, "ş": 16, "Ť": 16, "ť": 16, "Ů": 16, "ů": 16, "Ź": 16, "ź": 16, "Ż": 16, "ż": 16, "☐": 24, "✓": 24, "Ă": 16, "ă": 16, "ı": 16, "Ș": 16, "ș": 16, "Ț": 16, "ț": 16, "А": 18, "Б": 18, "В": 18, "Г": 18, "Ѓ": 18, "Ґ": 18, "Д": 18, "Е": 18, "Ё": 18, "Ж": 18, "З": 18, "И": 18, "Й": 18, "К": 18, "Ќ": 18, "Л": 18, "М": 18, "Н": 18, "О": 18, "П": 18, "Р": 18, "С": 18, "Т": 18, "У": 18, "Ў": 18, "Ф": 18, "Х": 18, "Ч": 18, "Ц": 18, "Ш": 18, "Щ": 20, "Џ": 18, "Ь": 18, "Ы": 18, "Ъ": 18, "Љ": 26, "Њ": 22, "Ѕ": 18, "Є": 18, "Э": 18, "І": 18, "Ї": 18, "Ј": 18, "Ћ": 18, "Ю": 18, "Я": 18, "Ђ": 18, "а": 18, "б": 18, "в": 18, "г": 18, "ѓ": 18, "ґ": 18, "д": 18, "е": 18, "ё": 18, "ж": 18, "з": 18, "и": 18, "й": 18, "к": 18, "ќ": 18, "л": 18, "м": 18, "н": 18, "о": 18, "п": 18, "р": 18, "с": 18, "т": 18, "у": 18, "ў": 18, "ф": 18, "х": 18, "ч": 18, "ц": 18, "ш": 18, "щ": 18, "џ": 18, "ь": 18, "ы": 18, "ъ": 18, "љ": 20, "њ": 18, "ѕ": 18, "є": 18, "э": 18, "і": 18, "ї": 18, "ј": 18, "ћ": 18, "ю": 18, "я": 18, "ђ": 18, "ǖ": 16, "ǘ": 16, "ǚ": 16, "ǜ": 16, "ǎ": 16, "ǐ": 16, "ǒ": 16, "ǔ": 16, "Ő": 16, "ő": 16, "Ű": 16, "ű": 16 };

  // src/background/g1text.ts
  var G1_LINE_PX = 556;
  var G1_LINES = 5;
  var UNKNOWN_PX = 18;
  function charPx(ch) {
    return G1_GLYPH_PX[ch] ?? UNKNOWN_PX;
  }
  function textPx(s) {
    let w = 0;
    for (const ch of s)
      w += charPx(ch);
    return w;
  }
  var REPLACE = {
    "№": "No",
    " ": " ",
    " ": " ",
    " ": " ",
    "\t": " ",
    "‑": "-",
    "‐": "-",
    "−": "-",
    "×": "x",
    "✓": "+",
    "✔": "+",
    "✗": "x",
    "★": "*",
    "➜": "→",
    "⇒": "→",
    "⟶": "→",
    "´": "'",
    "`": "'"
  };
  function sanitizeForG1(input) {
    let t = String(input ?? "").replace(/\r\n?/g, `
`);
    t = t.replace(/```[^\n]*\n?/g, "");
    t = t.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
    t = t.replace(/\[([^\]]+)\]\((?:[^()]|\([^)]*\))*\)/g, "$1");
    t = t.replace(/https?:\/\/(?:www\.)?([^\s/)]+)[^\s)]*/g, "$1");
    t = t.replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, "");
    t = t.replace(/^[ \t]{0,3}>[ \t]?/gm, "");
    t = t.replace(/^[ \t]*([-*_])([ \t]*\1){2,}[ \t]*$/gm, "");
    t = t.replace(/^[ \t]*\|?([ \t]*:?-{2,}:?[ \t]*\|)+[ \t]*:?-*:?[ \t]*$/gm, "");
    t = t.replace(/^[ \t]*\|(.*)\|[ \t]*$/gm, (_m, inner) => inner.split("|").map((c) => c.trim()).filter(Boolean).join(" · "));
    t = t.replace(/^[ \t]*[-*+•▪●◦][ \t]+/gm, "• ");
    t = t.replace(/(\*\*|__)(.+?)\1/g, "$2");
    t = t.replace(/(^|[\s(«"])[*_]([^*_\n]+)[*_](?=[\s).,!?:;»"]|$)/g, "$1$2");
    t = t.replace(/`([^`]*)`/g, "$1");
    t = t.replace(/【[^】]*】/g, "");
    t = t.replace(/\s?\[\d+(?:,\s*\d+)*\]/g, "");
    let out = "";
    for (const ch of t) {
      const r = REPLACE[ch];
      if (r !== undefined) {
        out += r;
      } else if (ch === `
` || G1_GLYPH_PX[ch] !== undefined) {
        out += ch;
      }
    }
    return out.split(`
`).map((l) => l.replace(/ {2,}/g, " ").trim()).filter((l) => l.length > 0).join(`
`);
  }
  function splitLongWord(word, maxPx) {
    const parts = [];
    let cur = "";
    let w = 0;
    const hyphen = charPx("-");
    for (const ch of word) {
      const cw = charPx(ch);
      if (cur && w + cw + hyphen > maxPx) {
        parts.push(cur + "-");
        cur = "";
        w = 0;
      }
      cur += ch;
      w += cw;
    }
    if (cur)
      parts.push(cur);
    return parts;
  }
  function wrapLines(text, maxPx = G1_LINE_PX) {
    const lines = [];
    const space = charPx(" ");
    for (const para of text.split(`
`)) {
      const words = para.split(" ").filter(Boolean);
      let cur = "";
      let w = 0;
      for (const word of words) {
        const pieces = textPx(word) > maxPx ? splitLongWord(word, maxPx) : [word];
        for (const piece of pieces) {
          const pw = textPx(piece);
          if (!cur) {
            cur = piece;
            w = pw;
          } else if (w + space + pw <= maxPx) {
            cur += " " + piece;
            w += space + pw;
          } else {
            lines.push(cur);
            cur = piece;
            w = pw;
          }
        }
      }
      if (cur)
        lines.push(cur);
    }
    return lines;
  }
  var FOOTER = {
    ru: { next: "дальше", last: "назад · сначала" },
    en: { next: "next", last: "back · first page" }
  };
  function paginate(text, opts = {}) {
    const linesPerScreen = opts.linesPerScreen ?? G1_LINES;
    const maxPx = opts.maxPx ?? G1_LINE_PX;
    const lines = wrapLines(text, maxPx);
    if (lines.length === 0)
      return [];
    if (lines.length <= linesPerScreen)
      return [lines.join(`
`)];
    const perPage = linesPerScreen - 1;
    const total = Math.ceil(lines.length / perPage);
    const pages = [];
    for (let i = 0;i < total; i++) {
      const chunk = lines.slice(i * perPage, (i + 1) * perPage);
      const words = FOOTER[opts.lang ?? "ru"];
      const hint = i === total - 1 ? words.last : words.next;
      const footer = `${i + 1}/${total} · ${hint}`;
      pages.push([...chunk, footer].join(`
`));
    }
    return pages;
  }
  function fitScreen(text, maxLines = G1_LINES) {
    const lines = wrapLines(sanitizeForG1(text));
    if (lines.length <= maxLines)
      return lines.join(`
`);
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/\s*\S*$/, "") + "…";
    return kept.join(`
`);
  }

  // src/background/voice.ts
  function normalize(s) {
    return String(s ?? "").toLowerCase().replace(/ё/g, "е").replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/-/g, " ").replace(/\s+/g, " ").trim();
  }
  var LEAD_INS = new Set(["эй", "ну", "окей", "ок", "хей", "алло", "так", "слушай", "hey", "ok", "okay", "so", "um", "uh"]);
  function tokenize(text) {
    return String(text ?? "").split(/\s+/).filter(Boolean).map((orig) => ({ orig, norm: normalize(orig) })).flatMap((t) => {
      const parts = t.norm.split(" ").filter(Boolean);
      if (parts.length <= 1)
        return [{ orig: t.orig, norm: t.norm }];
      return parts.map((p, i) => ({ orig: i === parts.length - 1 ? t.orig : "", norm: p }));
    }).filter((t) => t.norm.length > 0);
  }
  function detectWake(text, wakePhrases) {
    const tokens = tokenize(text);
    const phrases = wakePhrases.map((p) => normalize(p).split(" ").filter(Boolean)).filter((p) => p.length > 0).sort((a, b) => b.length - a.length);
    let start = 0;
    while (start < tokens.length && start < 2 && LEAD_INS.has(tokens[start].norm))
      start++;
    for (let offset = start;offset <= Math.min(start + 1, tokens.length - 1); offset++) {
      for (const phrase of phrases) {
        if (offset + phrase.length > tokens.length)
          continue;
        let ok = true;
        for (let j = 0;j < phrase.length; j++) {
          if (tokens[offset + j].norm !== phrase[j]) {
            ok = false;
            break;
          }
        }
        if (ok) {
          const rest = tokens.slice(offset + phrase.length).map((t) => t.orig).filter(Boolean).join(" ").replace(/^[\s,.:;!?—–-]+/, "").trim();
          return { matched: true, rest, phrase: phrase.join(" ") };
        }
      }
      if (offset > start)
        break;
    }
    return { matched: false, rest: "" };
  }
  var COMMANDS = [
    ["next", [
      "дальше",
      "далее",
      "следующая",
      "следующий",
      "следующую",
      "следующая страница",
      "следующую страницу",
      "листай",
      "листай дальше",
      "покажи дальше",
      "вперед",
      "еще",
      "продолжай",
      "продолжи",
      "next",
      "next page",
      "continue",
      "go on",
      "more"
    ]],
    ["prev", [
      "назад",
      "предыдущая",
      "предыдущий",
      "предыдущую",
      "предыдущая страница",
      "предыдущую страницу",
      "обратно",
      "вернись",
      "верни назад",
      "back",
      "go back",
      "previous",
      "previous page"
    ]],
    ["first", ["сначала", "с начала", "в начало", "первая страница", "к началу", "first page", "from the start", "from the beginning"]],
    ["repeat", ["повтори", "покажи снова", "покажи еще раз", "покажи ответ", "еще раз", "repeat", "again", "show again"]],
    ["hide", [
      "скрой",
      "скрыть",
      "убери",
      "убрать",
      "закрой",
      "закрыть",
      "спрячь",
      "очисти",
      "хватит",
      "достаточно",
      "hide",
      "close",
      "clear",
      "dismiss"
    ]],
    ["cancel", ["стоп", "отмена", "отмени", "отменить", "не надо", "stop", "cancel", "never mind", "nevermind"]],
    ["reset", [
      "новый разговор",
      "новый чат",
      "начни заново",
      "забудь разговор",
      "сбрось контекст",
      "очисти историю",
      "новая тема",
      "new conversation",
      "new chat",
      "new topic",
      "start over",
      "reset",
      "forget it"
    ]]
  ];
  var COMMAND_LOOKUP = new Map;
  for (const [cmd, phrases] of COMMANDS)
    for (const p of phrases)
      COMMAND_LOOKUP.set(normalize(p), cmd);
  function parseCommand(text) {
    const n = normalize(text);
    if (!n)
      return null;
    const FILLERS = /^(пожалуйста|ну|так|давай|а|и|окей|ок|хорошо|ладно|ага|угу|please|ok|okay|alright|so)$/;
    let words = n.split(" ").filter(Boolean);
    while (words.length > 1 && FILLERS.test(words[0]))
      words = words.slice(1);
    while (words.length > 1 && FILLERS.test(words[words.length - 1]))
      words = words.slice(0, -1);
    if (words.length > 1 && words.every((w) => w === words[0]))
      words = [words[0]];
    if (words.length > 4)
      return null;
    return COMMAND_LOOKUP.get(words.join(" ")) ?? null;
  }
  function isCommandPrefix(text) {
    const n = normalize(text);
    if (!n)
      return false;
    for (const phrase of COMMAND_LOOKUP.keys())
      if (phrase.startsWith(n))
        return true;
    return false;
  }
  function isMeaningful(text) {
    const n = normalize(text);
    return n.replace(/\s/g, "").length >= 3;
  }
  function detectLang(text) {
    let cyr = 0;
    let lat = 0;
    for (const word of String(text ?? "").split(/\s+/)) {
      const c = (word.match(/[а-яё]/gi) ?? []).length;
      const l = (word.match(/[a-z]/gi) ?? []).length;
      if (c === 0 && l === 0)
        continue;
      if (c >= l)
        cyr++;
      else
        lat++;
    }
    return lat > cyr ? "en" : "ru";
  }
  var TRANSLATE_START = [
    "транслейт",
    "трансляйт",
    "транслэйт",
    "translate",
    "переводи",
    "переводчик",
    "перевод",
    "режим перевода",
    "включи перевод",
    "включи переводчик",
    "начни перевод",
    "переводи мне",
    "translation",
    "translation mode",
    "start translation",
    "start translating",
    "translate mode"
  ];
  var TRANSLATE_STOP = [
    "стоп перевод",
    "стоп",
    "хватит",
    "хватит переводить",
    "выключи перевод",
    "выключи переводчик",
    "закончи перевод",
    "конец перевода",
    "перестань переводить",
    "отключи перевод",
    "останови перевод",
    "транслейт стоп",
    "стоп транслейт",
    "stop translation",
    "stop translating",
    "translation off",
    "end translation"
  ];
  var TRANSLATE_LOOKUP = new Map;
  for (const p of TRANSLATE_START)
    TRANSLATE_LOOKUP.set(normalize(p), "start");
  for (const p of TRANSLATE_STOP)
    TRANSLATE_LOOKUP.set(normalize(p), "stop");
  function parseTranslateCommand(text) {
    const n = normalize(text);
    if (!n)
      return null;
    const FILLERS = /^(пожалуйста|ну|так|давай|а|и|окей|ок|please|ok|okay)$/;
    let words = n.split(" ").filter(Boolean);
    while (words.length > 1 && FILLERS.test(words[0]))
      words = words.slice(1);
    while (words.length > 1 && FILLERS.test(words[words.length - 1]))
      words = words.slice(0, -1);
    if (words.length > 4)
      return null;
    return TRANSLATE_LOOKUP.get(words.join(" ")) ?? null;
  }
  var AI_WAKE = {
    openai: ["чат gpt", "chat gpt", "chatgpt", "чатгпт", "чат джипити", "джипити", "гпт", "gpt", "openai", "опенай"],
    anthropic: ["клод", "claude", "клауд", "клоуд", "клот"],
    gemini: ["джемини", "джемени", "гемини", "джеминай", "джимини", "gemini"]
  };
  var AI_BY_PHRASE = new Map;
  for (const [ai, names] of Object.entries(AI_WAKE))
    for (const n of names)
      AI_BY_PHRASE.set(normalize(n), ai);
  var AI_WAKE_WORDS = Object.values(AI_WAKE).flat();
  function aiForWakePhrase(phrase) {
    return phrase ? AI_BY_PHRASE.get(normalize(phrase)) ?? null : null;
  }
  var AI_FORMS = {
    openai: [...AI_WAKE.openai, "чат gpt", "чатгпт", "gpt", "джипити", "open ai", "openai"],
    anthropic: [...AI_WAKE.anthropic, "клода", "клоду", "клодом", "клоде", "claude"],
    gemini: [...AI_WAKE.gemini, "gemini", "джемини", "гугл", "google"]
  };
  var AI_BY_FORM = new Map;
  for (const [ai, forms] of Object.entries(AI_FORMS))
    for (const f of forms)
      AI_BY_FORM.set(normalize(f), ai);
  function parseSwitchCommand(text) {
    const n = normalize(text);
    if (!n || n.split(" ").length > 6)
      return null;
    const m = /^(?:(?:ну |давай |пожалуйста )*)(?:переключись|переключи|переключиться|перейди|используй|включи|поставь|switch|use|change)(?: на| to)? (.+)$/.exec(n);
    if (!m)
      return null;
    return AI_BY_FORM.get(m[1].trim()) ?? null;
  }
  var LECTURE_START = [
    "лекция",
    "режим лекции",
    "лекционный режим",
    "включи лекцию",
    "включи режим лекции",
    "начни лекцию",
    "конспект",
    "конспектируй",
    "веди конспект",
    "включи конспект",
    "начни конспект",
    "lecture",
    "lecture mode",
    "start lecture",
    "take notes",
    "start notes"
  ];
  var LECTURE_STOP = [
    "стоп лекция",
    "стоп лекции",
    "стоп конспект",
    "конец лекции",
    "лекция окончена",
    "лекция закончилась",
    "выключи лекцию",
    "выключи режим лекции",
    "закончи лекцию",
    "выйди из лекции",
    "останови лекцию",
    "выключи конспект",
    "закончи конспект",
    "останови конспект",
    "хватит конспектировать",
    "stop lecture",
    "end lecture",
    "lecture off",
    "stop notes",
    "stop taking notes"
  ];
  var LECTURE_LOOKUP = new Map;
  for (const p of LECTURE_START)
    LECTURE_LOOKUP.set(normalize(p), "start");
  for (const p of LECTURE_STOP)
    LECTURE_LOOKUP.set(normalize(p), "stop");
  function parseLectureCommand(text) {
    const n = normalize(text);
    if (!n)
      return null;
    const FILLERS = /^(пожалуйста|ну|так|давай|а|и|окей|ок|please|ok|okay)$/;
    let words = n.split(" ").filter(Boolean);
    while (words.length > 1 && FILLERS.test(words[0]))
      words = words.slice(1);
    while (words.length > 1 && FILLERS.test(words[words.length - 1]))
      words = words.slice(0, -1);
    return LECTURE_LOOKUP.get(words.join(" ")) ?? null;
  }
  var TALK_START = [
    "беседа",
    "режим беседы",
    "включи беседу",
    "включи режим беседы",
    "начни беседу",
    "суфлер",
    "режим суфлера",
    "включи суфлера",
    "подсказки",
    "режим подсказок",
    "включи подсказки",
    "conversation",
    "conversation mode",
    "talk mode",
    "prompter"
  ];
  var TALK_STOP = [
    "стоп беседа",
    "стоп беседы",
    "конец беседы",
    "выключи беседу",
    "выключи режим беседы",
    "закончи беседу",
    "останови беседу",
    "выйди из беседы",
    "стоп суфлер",
    "выключи суфлера",
    "стоп подсказки",
    "выключи подсказки",
    "хватит подсказок",
    "хватит подсказывать",
    "stop conversation",
    "end conversation",
    "conversation off",
    "stop prompter"
  ];
  var TALK_LOOKUP = new Map;
  for (const p of TALK_START)
    TALK_LOOKUP.set(normalize(p), "start");
  for (const p of TALK_STOP)
    TALK_LOOKUP.set(normalize(p), "stop");
  function parseTalkCommand(text) {
    const n = normalize(text);
    if (!n)
      return null;
    const FILLERS = /^(пожалуйста|ну|так|давай|а|и|окей|ок|please|ok|okay)$/;
    let words = n.split(" ").filter(Boolean);
    while (words.length > 1 && FILLERS.test(words[0]))
      words = words.slice(1);
    while (words.length > 1 && FILLERS.test(words[words.length - 1]))
      words = words.slice(0, -1);
    return TALK_LOOKUP.get(words.join(" ")) ?? null;
  }
  var PHRASE_LANG_NAME = {
    en: "английский",
    ru: "русский",
    de: "немецкий",
    fr: "французский",
    es: "испанский",
    it: "итальянский",
    zh: "китайский",
    ja: "японский"
  };
  var LANG_STEMS = [
    [/^(англ|english)/, "en"],
    [/^(русск|russian)/, "ru"],
    [/^(немец|german)/, "de"],
    [/^(француз|french)/, "fr"],
    [/^(испан|spanish)/, "es"],
    [/^(итальян|italian)/, "it"],
    [/^(китай|chinese)/, "zh"],
    [/^(япон|japanese)/, "ja"]
  ];
  function langOf(word) {
    const w = String(word ?? "").toLowerCase();
    for (const [re, l] of LANG_STEMS)
      if (re.test(w))
        return l;
    return null;
  }
  var L = "(англ\\S*|русск\\S*|немецк\\S*|французск\\S*|испанск\\S*|итальянск\\S*|китайск\\S*|японск\\S*)";
  var IN_LANG = `(?:на\\s+${L}(?:\\s+язык\\S*)?|по[-\\s]${L})`;
  var ASK = "(?:а\\s+|и\\s+|слушай,?\\s+|скажи,?\\s+)?как\\s+(?:будет|сказать|это\\s+будет|это|перевести|переводится|называется)?";
  var EN_LANGS = "(english|russian|german|french|spanish|italian|chinese|japanese)";
  var PATTERNS = [
    { re: new RegExp(`^${ASK}\\s*${IN_LANG}\\s*(?:будет\\s+)?[:,—–-]?\\s*(.*)$`, "iu"), lang: (m) => langOf(m[1] ?? m[2]), phrase: (m) => m[3] },
    { re: new RegExp(`^${ASK}\\s+(.+?)\\s+${IN_LANG}\\s*$`, "iu"), lang: (m) => langOf(m[2] ?? m[3]), phrase: (m) => m[1] },
    { re: new RegExp(`^(?:пожалуйста,?\\s+)?переведи(?:те)?\\s+${IN_LANG}\\s*[:,—–-]?\\s*(.*)$`, "iu"), lang: (m) => langOf(m[1] ?? m[2]), phrase: (m) => m[3] },
    { re: new RegExp(`^(?:пожалуйста,?\\s+)?переведи(?:те)?\\s+(.+?)\\s+${IN_LANG}\\s*$`, "iu"), lang: (m) => langOf(m[2] ?? m[3]), phrase: (m) => m[1] },
    { re: new RegExp(`^(?:so\\s+|and\\s+)?how\\s+(?:do\\s+(?:you|i|we)\\s+say|to\\s+say|would\\s+you\\s+say|is)\\s+(.+?)\\s+in\\s+${EN_LANGS}\\s*$`, "iu"), lang: (m) => langOf(m[2]), phrase: (m) => m[1] },
    { re: new RegExp(`^(?:so\\s+|and\\s+)?what(?:'s|\\s+is)\\s+(.+?)\\s+in\\s+${EN_LANGS}\\s*$`, "iu"), lang: (m) => langOf(m[2]), phrase: (m) => m[1] },
    { re: new RegExp(`^(?:please\\s+)?translate\\s+(.+?)\\s+(?:in)?to\\s+${EN_LANGS}\\s*$`, "iu"), lang: (m) => langOf(m[2]), phrase: (m) => m[1] }
  ];
  function parsePhraseRequest(text) {
    const t = String(text ?? "").replace(/\s+/g, " ").trim().replace(/[?？!.…]+$/u, "").trim();
    if (!t)
      return null;
    for (const p of PATTERNS) {
      const m = p.re.exec(t);
      if (!m)
        continue;
      const lang = p.lang(m);
      if (!lang)
        continue;
      const phrase = String(p.phrase(m) ?? "").trim().replace(/^[«"“'„]+|[»"”']+$/gu, "").replace(/[?？!.…,]+$/u, "").trim();
      if (phrase.split(/\s+/).length > 14)
        return null;
      if (/^(это|этот|эта|это слово|эту фразу)$/i.test(phrase))
        return { lang, phrase: "" };
      return { lang, phrase };
    }
    return null;
  }

  // src/background/openai.ts
  var OPENAI_URL = "https://api.openai.com/v1/responses";
  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }
  function localDateTime(d = new Date) {
    const days = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
    const off = -d.getTimezoneOffset();
    const sign = off >= 0 ? "+" : "-";
    const tz = `UTC${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())} (${days[d.getDay()]}, ${tz})`;
  }
  function buildInstructions(s, now = new Date, questionLang = "ru") {
    const parts = [
      "Ты — голосовой помощник. Твои ответы показываются на крошечном дисплее умных очков Even Realities G1: 5 строк примерно по 30 символов, монохромный текст. Пользователь не видит телефон.",
      "Отвечай на том же языке, на котором задан последний вопрос: на русский вопрос — по-русски, на английский — по-английски (English question → answer in English). Если пользователь прямо попросил другой язык — используй его.",
      "Пиши обычным текстом без Markdown: без заголовков, звёздочек, таблиц, ссылок, эмодзи и блоков кода.",
      `Начинай сразу с сути, без вступлений и повторения вопроса. По умолчанию уложись примерно в ${s.answerWords} слов. Если пользователь просит подробнее или вопрос этого требует — можно длиннее, короткими абзацами.`,
      "Списки оформляй короткими строками, каждая начинается с «• ». Числа пиши цифрами.",
      "Вопрос получен через распознавание речи и может содержать ошибки — угадывай смысл по контексту.",
      "Старайся отвечать сразу, без встречных вопросов: если чего-то не хватает (например, города отправления), сделай разумное предположение — по сведениям о пользователе, если они есть, — коротко назови его и ответь. Переспрашивай, только если без уточнения ответ бесполезен, и тогда задай один короткий вопрос.",
      "Учитывай предыдущие реплики разговора: пользователь может задавать уточняющие вопросы.",
      `Текущие дата и время у пользователя: ${localDateTime(now)}.`
    ];
    if (s.aboutMe.trim())
      parts.push(`Что известно о пользователе (учитывай, когда уместно):
${s.aboutMe.trim()}`);
    if (s.instructions.trim())
      parts.push(`Дополнительные пожелания пользователя:
${s.instructions.trim()}`);
    parts.push(questionLang === "en" ? "The latest question was asked in English. Answer in English (unless the user explicitly asks for another language)." : "Последний вопрос задан по-русски — отвечай по-русски (если пользователь прямо не попросил другой язык).");
    return parts.join(`

`);
  }
  function effortFor(s) {
    if (s.effort !== "auto")
      return s.effort;
    const m = s.model.toLowerCase();
    if (m.includes("terra") || m.includes("luna"))
      return "none";
    if (m.includes("sol") || m.includes("astra"))
      return "low";
    return null;
  }
  function openAIMaxTokens(s) {
    const base = Math.min(8000, Math.max(800, s.answerWords * 12));
    const effort = effortFor(s);
    if (effort === "high")
      return 16000;
    if (effort === "medium")
      return Math.max(base, 8000);
    if (effort === "low")
      return Math.max(base, 4000);
    return base;
  }
  function buildRequestBody(s, history, question, opts = {}) {
    const recent = s.historyMessages > 0 ? history.slice(-s.historyMessages) : [];
    const input = [
      ...recent.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: question }
    ];
    const body = {
      model: s.model,
      instructions: opts.system ?? buildInstructions(s, opts.now, detectLang(question)),
      input,
      store: false,
      max_output_tokens: openAIMaxTokens(s)
    };
    const effort = effortFor(s);
    if (effort && opts.includeReasoning !== false)
      body.reasoning = { effort };
    if (s.webSearch)
      body.tools = [{ type: "web_search" }];
    return body;
  }
  function extractText(data) {
    if (data && typeof data.output_text === "string" && data.output_text.trim())
      return data.output_text.trim();
    const out = [];
    for (const item of Array.isArray(data?.output) ? data.output : []) {
      if (item?.type !== "message")
        continue;
      for (const c of Array.isArray(item.content) ? item.content : []) {
        if ((c?.type === "output_text" || c?.type === "text") && typeof c.text === "string")
          out.push(c.text);
      }
    }
    return out.join(`
`).trim();
  }

  class OpenAIError extends Error {
    status;
    code;
    raw;
    constructor(message, status, code, raw) {
      super(message);
      this.status = status;
      this.code = code;
      this.raw = raw;
      this.name = "OpenAIError";
    }
  }
  function parseError(status, raw) {
    let code = "";
    let message = raw.slice(0, 300);
    try {
      const j = JSON.parse(raw);
      code = String(j?.error?.code ?? j?.error?.type ?? "");
      message = String(j?.error?.message ?? message);
    } catch {}
    return new OpenAIError(message, status, code, raw.slice(0, 1000));
  }
  function withTimeout(p, ms, setTimer) {
    return new Promise((resolve, reject) => {
      const t = setTimer(() => reject(new OpenAIError("timeout", 0, "timeout", "")), ms);
      p.then((v) => {
        clearTimeout(t);
        resolve(v);
      }, (e) => {
        clearTimeout(t);
        reject(e);
      });
    });
  }
  async function askOpenAI(fetchFn, s, history, question, opts = {}) {
    if (!s.apiKey)
      throw new OpenAIError("no key", 401, "no_key", "");
    const now = opts.now ?? Date.now;
    const setTimer = opts.setTimer ?? setTimeout;
    const started = now();
    const send = async (includeReasoning) => {
      const body = JSON.stringify(buildRequestBody(s, history, question, { includeReasoning, system: opts.system }));
      let res;
      try {
        res = await withTimeout(fetchFn(OPENAI_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.apiKey}` },
          body
        }), opts.timeoutMs ?? 60000, setTimer);
      } catch (e) {
        if (e instanceof OpenAIError)
          throw e;
        throw new OpenAIError(String(e?.message ?? e), 0, "network", "");
      }
      const raw = await res.text();
      return { res, raw };
    };
    let { res, raw } = await send(true);
    if (!res.ok && res.status === 400 && /reasoning|effort/i.test(raw) && effortFor(s)) {
      ({ res, raw } = await send(false));
    }
    if (!res.ok)
      throw parseError(res.status, raw);
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new OpenAIError("bad json", res.status, "bad_json", raw.slice(0, 300));
    }
    const text = extractText(data);
    if (!text) {
      const reason = data?.incomplete_details?.reason ?? data?.status ?? "empty";
      throw new OpenAIError(`empty answer (${reason})`, res.status, "empty", raw.slice(0, 300));
    }
    return { text, ms: now() - started, model: String(data?.model ?? s.model), usage: data?.usage };
  }

  // src/background/llm.ts
  var PROVIDERS = {
    openai: {
      label: "ChatGPT",
      company: "OpenAI",
      keyField: "apiKey",
      modelField: "model",
      keyPlaceholder: "sk-…",
      keyWhere: "platform.openai.com → API keys",
      models: [
        { id: "gpt-6.1-terra", label: "GPT‑6.1 Terra" },
        { id: "gpt-6-luna", label: "GPT‑6 Luna" },
        { id: "gpt-6.1-sol", label: "GPT‑6.1 Sol" },
        { id: "gpt-6-astra", label: "GPT‑6 Astra" }
      ]
    },
    anthropic: {
      label: "Claude",
      company: "Anthropic",
      keyField: "anthropicKey",
      modelField: "anthropicModel",
      keyPlaceholder: "sk-ant-…",
      keyWhere: "platform.claude.com/settings/keys → Create key; в поле Workspace выберите рабочее пространство (например, Default)",
      models: [
        { id: "claude-haiku-5-5", label: "Haiku 5.5" },
        { id: "claude-sonnet-5-5", label: "Sonnet 5.5" },
        { id: "claude-opus-5-5", label: "Opus 5.5" },
        { id: "claude-fable-5-1", label: "Fable 5.1" }
      ]
    },
    gemini: {
      label: "Gemini",
      company: "Google",
      keyField: "geminiKey",
      modelField: "geminiModel",
      keyPlaceholder: "AIza…",
      keyWhere: "aistudio.google.com/apikey → Create API key",
      models: [
        { id: "gemini-3.8-flash", label: "3.8 Flash" },
        { id: "gemini-3.5-flash-lite", label: "3.5 Flash‑Lite" },
        { id: "gemini-4-argon", label: "4 Argon" }
      ]
    }
  };
  function asProvider(v) {
    return v === "anthropic" || v === "gemini" ? v : "openai";
  }
  function keyFor(s, p) {
    return String(s[PROVIDERS[p].keyField] ?? "");
  }
  function modelFor(s, p) {
    return String(s[PROVIDERS[p].modelField] ?? "");
  }
  function modelLabel(p, id) {
    return PROVIDERS[p].models.find((m) => m.id === id)?.label ?? id;
  }
  function displayName(s, p) {
    return `${PROVIDERS[p].label} ${modelLabel(p, modelFor(s, p))}`;
  }

  class LLMError extends Error {
    provider;
    status;
    code;
    constructor(message, provider, status, code) {
      super(message);
      this.provider = provider;
      this.status = status;
      this.code = code;
      this.name = "LLMError";
    }
  }
  function explainLLMError(p, status, code, message) {
    const name = p === "openai" ? "OpenAI" : PROVIDERS[p].label;
    const m = (message || "").toLowerCase();
    const c = (code || "").toLowerCase();
    if (c === "no_key")
      return `Нет ключа ${name}. Добавьте его в настройках приложения.`;
    if (c === "timeout")
      return `${name} не ответил вовремя. Повторите вопрос.`;
    if (status === 0)
      return `Нет связи с ${name}. Проверьте интернет на телефоне.`;
    if (status === 401 || c === "authentication_error" || /api key not valid|invalid api key|invalid x-api-key/.test(m))
      return `Ключ ${name} не принят. Проверьте ключ в настройках.`;
    if (/anthropic-workspace-id|not scoped to a workspace/.test(m))
      return "Ключ Claude не привязан к рабочему пространству. Создайте новый на platform.claude.com/settings/keys и выберите Workspace (например, Default).";
    if (c === "insufficient_quota" || /credit balance|billing|insufficient.*(funds|credit)/.test(m) || p === "openai" && m.includes("quota"))
      return p === "openai" ? "На счёте OpenAI API нет средств. Пополните баланс на platform.openai.com." : `На счёте ${name} нет средств. Пополните баланс у ${PROVIDERS[p].company}.`;
    if (p === "gemini" && (status === 429 || c === "resource_exhausted"))
      return "Лимит Gemini исчерпан. Подождите минуту или подключите оплату в Google AI Studio.";
    if (c === "empty")
      return /max_output_tokens|max_tokens|incomplete/.test(m) ? `${name}: ответ не уместился — модель потратила лимит на размышления. Уменьшите «Размышления» в настройках.` : `${name} вернул пустой ответ. Повторите вопрос.`;
    if (status === 529 || c === "overloaded_error")
      return `${name} сейчас перегружен. Повторите через минуту.`;
    if (status === 429)
      return `${name} просит подождать (лимит запросов). Повторите через минуту.`;
    if (status === 404 || c === "model_not_found" || c === "not_found_error" || c === "not_found")
      return "Модель недоступна для вашего ключа. Выберите другую в настройках.";
    if (status === 403)
      return `Доступ запрещён: проверьте ключ и права ${name}.`;
    if (status >= 500)
      return `Сбой на стороне ${name}. Повторите вопрос.`;
    return `Ошибка ${name} ${status}${code ? " (" + code + ")" : ""}.`;
  }
  function alternatingHistory(history, limit) {
    const recent = limit > 0 ? history.slice(-limit) : [];
    const out = [];
    for (const m of recent) {
      if (!out.length && m.role !== "user")
        continue;
      if (out.length && out[out.length - 1].role === m.role) {
        out[out.length - 1] = { ...out[out.length - 1], content: out[out.length - 1].content + `
` + m.content };
      } else
        out.push(m);
    }
    if (out.length && out[out.length - 1].role === "user")
      out.pop();
    return out;
  }
  function maxTokens(s) {
    const base = Math.min(8000, Math.max(1024, s.answerWords * 12));
    if (s.effort === "high")
      return Math.max(base, 16000);
    if (s.effort === "medium")
      return Math.max(base, 8000);
    return base;
  }
  async function post(p, fetchFn, url, headers, body, opts) {
    const setTimer = opts.setTimer ?? setTimeout;
    const req = fetchFn(url, { method: "POST", headers, body: JSON.stringify(body) });
    let res;
    try {
      res = await new Promise((resolve, reject) => {
        const t = setTimer(() => reject(new LLMError("timeout", p, 0, "timeout")), opts.timeoutMs ?? 60000);
        req.then((v) => {
          clearTimeout(t);
          resolve(v);
        }, (e) => {
          clearTimeout(t);
          reject(e);
        });
      });
    } catch (e) {
      if (e instanceof LLMError)
        throw e;
      throw new LLMError(String(e?.message ?? e), p, 0, "network");
    }
    return { ok: res.ok, status: res.status, raw: await res.text() };
  }
  function parseJson(p, status, raw) {
    try {
      return JSON.parse(raw);
    } catch {
      throw new LLMError(`bad json: ${raw.slice(0, 200)}`, p, status, "bad_json");
    }
  }
  var ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
  var ANTHROPIC_VERSION = "2023-06-01";
  function anthropicReasoning(s) {
    const m = s.anthropicModel.toLowerCase();
    if (s.effort === "auto" || s.effort === "none") {
      if (m.includes("haiku"))
        return { thinking: { type: "disabled" }, output_config: { effort: "low" } };
      if (m.includes("sonnet"))
        return { thinking: { type: "between_tools" }, output_config: { effort: "low" } };
      return { output_config: { effort: "low" } };
    }
    return { output_config: { effort: s.effort } };
  }
  function buildAnthropicBody(s, history, question, opts = {}) {
    const body = {
      model: s.anthropicModel,
      max_tokens: maxTokens(s),
      system: opts.system ?? buildInstructions(s, opts.now, detectLang(question)),
      messages: [
        ...alternatingHistory(history, s.historyMessages).map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: question }
      ]
    };
    if (opts.includeReasoning !== false)
      Object.assign(body, anthropicReasoning(s));
    if (s.webSearch)
      body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }];
    return body;
  }
  function extractAnthropicText(data) {
    const blocks = Array.isArray(data?.content) ? data.content : [];
    let start = 0;
    blocks.forEach((b, i) => {
      if (b?.type === "web_search_tool_result")
        start = i + 1;
    });
    const tail = blocks.slice(start).filter((b) => b?.type === "text" && typeof b.text === "string");
    const use = tail.length ? tail : blocks.filter((b) => b?.type === "text" && typeof b.text === "string");
    return use.map((b) => b.text).join("").trim();
  }
  async function askAnthropic(fetchFn, s, history, q, opts) {
    const key = s.anthropicKey;
    if (!key)
      throw new LLMError("no key", "anthropic", 401, "no_key");
    const headers = { "content-type": "application/json", "x-api-key": key, "anthropic-version": ANTHROPIC_VERSION };
    let r = await post("anthropic", fetchFn, ANTHROPIC_URL, headers, buildAnthropicBody(s, history, q, { system: opts.system }), opts);
    if (!r.ok && r.status === 400 && /thinking|effort|output_config/i.test(r.raw)) {
      r = await post("anthropic", fetchFn, ANTHROPIC_URL, headers, buildAnthropicBody(s, history, q, { includeReasoning: false, system: opts.system }), opts);
    }
    const data = parseJson("anthropic", r.status, r.raw);
    if (!r.ok) {
      throw new LLMError(String(data?.error?.message ?? r.raw.slice(0, 300)), "anthropic", r.status, String(data?.error?.type ?? ""));
    }
    const text = extractAnthropicText(data);
    if (!text)
      throw new LLMError(`empty answer (${data?.stop_reason ?? "?"})`, "anthropic", r.status, "empty");
    return {
      text,
      ms: 0,
      model: String(data?.model ?? s.anthropicModel),
      usage: { input_tokens: data?.usage?.input_tokens, output_tokens: data?.usage?.output_tokens }
    };
  }
  var GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models/";
  function geminiThinkingLevel(s) {
    if (s.effort === "low" || s.effort === "medium" || s.effort === "high")
      return s.effort;
    return s.geminiModel.toLowerCase().includes("lite") ? "minimal" : "low";
  }
  function buildGeminiBody(s, history, question, opts = {}) {
    const generationConfig = { maxOutputTokens: maxTokens(s) };
    if (opts.includeReasoning !== false)
      generationConfig.thinkingConfig = { thinkingLevel: geminiThinkingLevel(s) };
    const body = {
      systemInstruction: { parts: [{ text: opts.system ?? buildInstructions(s, opts.now, detectLang(question)) }] },
      contents: [
        ...alternatingHistory(history, s.historyMessages).map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }]
        })),
        { role: "user", parts: [{ text: question }] }
      ],
      generationConfig
    };
    if (s.webSearch)
      body.tools = [{ google_search: {} }];
    return body;
  }
  function extractGeminiText(data) {
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    return parts.filter((p) => p && !p.thought && typeof p.text === "string").map((p) => p.text).join("").trim();
  }
  async function askGemini(fetchFn, s, history, q, opts) {
    const key = s.geminiKey;
    if (!key)
      throw new LLMError("no key", "gemini", 401, "no_key");
    const url = `${GEMINI_BASE}${encodeURIComponent(s.geminiModel)}:generateContent`;
    const headers = { "Content-Type": "application/json", "x-goog-api-key": key };
    let r = await post("gemini", fetchFn, url, headers, buildGeminiBody(s, history, q, { system: opts.system }), opts);
    if (!r.ok && r.status === 400 && /thinking/i.test(r.raw)) {
      r = await post("gemini", fetchFn, url, headers, buildGeminiBody(s, history, q, { includeReasoning: false, system: opts.system }), opts);
    }
    const data = parseJson("gemini", r.status, r.raw);
    if (!r.ok) {
      throw new LLMError(String(data?.error?.message ?? r.raw.slice(0, 300)), "gemini", r.status, String(data?.error?.status ?? ""));
    }
    const text = extractGeminiText(data);
    if (!text) {
      const reason = data?.promptFeedback?.blockReason ?? data?.candidates?.[0]?.finishReason ?? "?";
      throw new LLMError(`empty answer (${reason})`, "gemini", r.status, "empty");
    }
    const u = data?.usageMetadata ?? {};
    return {
      text,
      ms: 0,
      model: String(data?.modelVersion ?? s.geminiModel),
      usage: { input_tokens: u.promptTokenCount, output_tokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0) }
    };
  }
  async function askLLM(fetchFn, s, provider, history, question, opts = {}) {
    const now = opts.now ?? Date.now;
    const started = now();
    try {
      let res;
      if (provider === "anthropic")
        res = await askAnthropic(fetchFn, s, history, question, opts);
      else if (provider === "gemini")
        res = await askGemini(fetchFn, s, history, question, opts);
      else
        res = await askOpenAI(fetchFn, s, history, question, opts);
      return { ...res, ms: now() - started, provider };
    } catch (e) {
      if (e instanceof LLMError)
        throw e;
      if (e instanceof OpenAIError)
        throw new LLMError(e.message, "openai", e.status, e.code);
      throw new LLMError(String(e?.message ?? e), provider, 0, "network");
    }
  }

  // src/background/lecture.ts
  var DEFAULT_LECTURE_EVERY_SEC = 15;
  var LECTURE_EVERY_MIN_SEC = 10;
  var LECTURE_EVERY_MAX_SEC = 60;
  function lectureTiming(everySec) {
    const sec = Math.max(LECTURE_EVERY_MIN_SEC, Math.min(LECTURE_EVERY_MAX_SEC, Math.round(Number(everySec) || DEFAULT_LECTURE_EVERY_SEC)));
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));
    return {
      intervalMs: sec * 1000,
      minWords: clamp(sec * 1.2, 10, 70),
      maxWords: clamp(sec * 4, 50, 240),
      flushMs: clamp(sec * 500, 4000, 12000),
      flushMinWords: 8,
      maxPoints: sec <= 25 ? 2 : 3
    };
  }
  var LECTURE_ANSWER_HOLD_MS = 30000;
  var CONTEXT_WORDS = 600;
  var LECTURE_RESUME_MS = 20 * 60000;
  var PREV_POINTS = 8;
  var NOTES_MAX = 400;
  var ERROR_SHOW_EVERY_MS = 60000;
  function wordCount(s) {
    return String(s ?? "").split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  }
  var HOUSEKEEPING = [
    "any questions",
    "are there any questions",
    "do you have any questions",
    "any more questions",
    "any other questions",
    "questions so far",
    "can you hear me",
    "can everyone hear",
    "can you all hear",
    "can you see",
    "can everyone see",
    "is that clear",
    "is this clear",
    "does that make sense",
    "does this make sense",
    "are you with me",
    "are we ready",
    "everyone ready",
    "is everyone ready",
    "are you ready",
    "is everyone here",
    "shall we start",
    "shall we begin",
    "shall we continue",
    "ok",
    "okay",
    "right",
    "yes",
    "all right",
    "alright",
    "you know",
    "есть вопросы",
    "есть ли вопросы",
    "какие то вопросы",
    "все слышат",
    "всем слышно",
    "меня слышно",
    "понятно",
    "всем понятно",
    "всё понятно",
    "все понятно",
    "готовы",
    "продолжим",
    "начнем",
    "начинаем",
    "да"
  ];
  var AUDIENCE_CUES = [
    "does anyone",
    "does anybody",
    "can anyone",
    "can anybody",
    "can someone",
    "could anyone",
    "could someone",
    "anyone know",
    "anybody know",
    "who can tell",
    "who knows",
    "who can explain",
    "who wants to",
    "any ideas",
    "any guesses",
    "what do you think",
    "what would you say",
    "raise your hand",
    "hands up",
    "who remembers",
    "кто знает",
    "кто может",
    "кто скажет",
    "кто нибудь",
    "как вы думаете",
    "есть идеи",
    "кто помнит",
    "поднимите руку"
  ];
  function findAudienceQuestion(text) {
    const sentences = String(text ?? "").replace(/\s+/g, " ").split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
    for (let i = sentences.length - 1;i >= 0; i--) {
      const s = sentences[i];
      const n = normalize(s);
      if (wordCount(s) < 4)
        continue;
      if (HOUSEKEEPING.some((h) => n === h || n.startsWith(h + " ")))
        continue;
      if (/\?["»”')\s]*$/.test(s) || AUDIENCE_CUES.some((c) => (" " + n + " ").includes(" " + c + " ")))
        return s;
    }
    return null;
  }
  function langName(lang) {
    return lang === "en" ? "английском (English)" : "русском";
  }
  function buildPointsPrompt(prevPoints, chunk, lang, maxPoints = 2) {
    const system = [
      "Ты помогаешь студенту на лекции. Твой ответ показывается на крошечном дисплее умных очков: 5 строк примерно по 30 символов.",
      "Тебе дают свежий фрагмент речи лектора, распознанный автоматически: возможны ошибки распознавания и обрывки фраз — угадывай смысл по контексту.",
      `Выдели суть: ${maxPoints <= 1 ? "один короткий тезис" : `1–${maxPoints} коротких тезиса (чаще хватает одного)`} на ${langName(lang)} языке, каждый с новой строки и начинается с «• », не длиннее 12 слов.`,
      "Не переводи и не пересказывай дословно — только главное: определения, утверждения, формулы, числа и даты, примеры, выводы. Термины можно оставлять в оригинале.",
      "Если лектор цитирует кого-то, сделай отдельный тезис «Цитата: автор (источник) — суть»; если цитату приписали не тому — укажи настоящего автора.",
      "Не повторяй уже записанные тезисы. Если во фрагменте нет ничего содержательного (приветствие, организационные моменты, шум, повтор), ответь ровно SKIP.",
      "Без Markdown, без вступлений и пояснений."
    ].join(`
`);
    const prev = prevPoints.length ? `Уже записанные тезисы:
${prevPoints.map((p) => "• " + p).join(`
`)}

` : "";
    return { system, user: `${prev}Новый фрагмент лекции:
«${chunk.trim()}»` };
  }
  function buildAnswerPrompt(context, question, lang, fromUser) {
    const system = fromUser ? [
      "Студент сидит на лекции и тихо задаёт тебе вопрос. Ответ показывается на крошечном дисплее умных очков.",
      `Ответь коротко и по делу, не больше 30 слов, на ${langName(lang)} языке. Если вопрос относится к лекции — учитывай её контекст.`,
      `Формат ровно две строки:
Q: <вопрос, до 8 слов>
A: <ответ>`,
      "Без Markdown и вступлений."
    ].join(`
`) : [
      "Ты помогаешь студенту на лекции. Лектор только что обратился к аудитории с вопросом; текст распознан автоматически, возможны ошибки.",
      `Дай короткий правильный ответ, который студент может сказать вслух: не больше 25 слов, на ${langName(lang)} языке. Учитывай контекст лекции.`,
      `Формат ровно две строки:
Q: <вопрос лектора, до 8 слов>
A: <ответ>`,
      "Если это организационный вопрос (есть ли вопросы, слышно ли, понятно ли, готовы ли) или вопрос, на который нечего ответить по существу, ответь ровно SKIP.",
      "Без Markdown и вступлений."
    ].join(`
`);
    const ctx = context.trim() ? `Недавно на лекции:
«${context.trim()}»

` : "";
    return { system, user: `${ctx}${fromUser ? "Вопрос студента" : "Вопрос лектора"}: «${question.trim()}»` };
  }
  var isSkip = (t) => /^\s*skip\b/i.test(t) || /^\s*[—–-]\s*$/.test(t);
  function parsePoints(text) {
    if (!String(text ?? "").trim() || isSkip(text))
      return [];
    return String(text).split(/\n+/).map((l) => l.replace(/^\s*(?:[•*\-–—]|\d+[.)])\s*/, "").replace(/\*\*/g, "").trim()).filter((l) => l && !isSkip(l)).slice(0, 3);
  }
  function feedScreen(allPoints, newCount) {
    const blocks = [];
    let used = 0;
    for (let i = allPoints.length - 1;i >= 0; i--) {
      const isNew = i >= allPoints.length - newCount;
      const lines = wrapLines(sanitizeForG1((isNew ? "• " : "· ") + allPoints[i]));
      if (used + lines.length > G1_LINES) {
        if (!blocks.length)
          blocks.unshift(lines);
        break;
      }
      blocks.unshift(lines);
      used += lines.length;
    }
    const lines = blocks.flat();
    if (lines.length <= G1_LINES)
      return lines.join(`
`);
    return pointsScreen(allPoints.slice(-1));
  }
  function parseAnswer(text, fallbackQ) {
    const t = String(text ?? "").trim();
    if (!t || isSkip(t))
      return null;
    const q = /^\s*(?:Q|В|Вопрос)\s*[:：]\s*(.+)$/im.exec(t)?.[1]?.trim();
    const aMatch = /^\s*(?:A|О|Ответ)\s*[:：]\s*([\s\S]+)$/im.exec(t);
    const a = (aMatch ? aMatch[1] : t.replace(/^\s*(?:Q|В|Вопрос)\s*[:：].*$/im, "")).replace(/\*\*/g, "").replace(/\s*\n\s*/g, " ").trim();
    if (!a || isSkip(a))
      return null;
    return { q: q || fallbackQ, a };
  }
  function pointsScreen(points) {
    const lines = wrapLines(sanitizeForG1(points.map((p) => "• " + p).join(`
`)));
    if (lines.length <= G1_LINES)
      return lines.join(`
`);
    const kept = lines.slice(0, G1_LINES);
    kept[G1_LINES - 1] = kept[G1_LINES - 1].replace(/\s*\S*$/, "") + "…";
    return kept.join(`
`);
  }
  function answerScreen(q, a) {
    const qLines = wrapLines(sanitizeForG1("? " + q));
    const qLine = qLines.length > 1 ? qLines[0].replace(/\s*\S*$/, "") + "…" : qLines[0] ?? "";
    const aLines = wrapLines(sanitizeForG1("→ " + a));
    const room = G1_LINES - (qLine ? 1 : 0);
    const shown = aLines.slice(0, room);
    if (aLines.length > room)
      shown[room - 1] = shown[room - 1].replace(/\s*\S*$/, "") + "…";
    return [qLine, ...shown].filter(Boolean).join(`
`);
  }

  class Lecture {
    deps;
    active = false;
    record;
    screen = "";
    session = 0;
    buffer = [];
    recent = [];
    lastSummaryAt = 0;
    summarizing = false;
    answering = false;
    pendingQuestion = null;
    holdUntil = 0;
    pendingFeed = false;
    lastNewCount = 0;
    flushTimer = null;
    holdTimer = null;
    lastErrorShownAt = -Infinity;
    constructor(deps, saved = null) {
      this.deps = deps;
      this.record = saved;
    }
    start() {
      this.stopTimers();
      this.session++;
      this.active = true;
      this.buffer = [];
      this.recent = [];
      this.summarizing = false;
      this.answering = false;
      this.pendingQuestion = null;
      this.pendingFeed = false;
      this.holdUntil = 0;
      this.lastSummaryAt = this.deps.now();
      const prev = this.record;
      const resume = Boolean(prev?.endedAt && this.deps.now() - prev.endedAt < LECTURE_RESUME_MS);
      if (resume && prev)
        delete prev.endedAt;
      else
        this.record = { startedAt: this.deps.now(), notes: [] };
      this.deps.save(this.record);
      const en = this.deps.lang() === "en";
      const sec = this.timing().intervalMs / 1000;
      this.setScreen(en ? `Lecture mode
• key points every ~${sec} s
• answers to the lecturer's questions
Stop: «стоп лекция»` : `Режим лекции
• тезисы примерно раз в ${sec} с
• ответы на вопросы лектора
Выключить: «стоп лекция»`);
      this.deps.log("lecture", resume ? "Режим лекции включён — продолжаю прежний конспект" : "Режим лекции включён");
      this.deps.onChange();
    }
    stop() {
      const notes = this.record?.notes ?? [];
      const summary = { points: notes.filter((n) => n.kind === "point").length, answers: notes.filter((n) => n.kind !== "point").length };
      if (!this.active)
        return summary;
      this.active = false;
      this.session++;
      this.stopTimers();
      this.buffer = [];
      this.pendingQuestion = null;
      this.pendingFeed = false;
      this.screen = "";
      if (this.record) {
        this.record.endedAt = this.deps.now();
        this.deps.save(this.record);
      }
      this.deps.log("lecture", `Режим лекции выключен: тезисов ${summary.points}, ответов ${summary.answers}`);
      this.deps.onChange();
      return summary;
    }
    onSpeech(text) {
      if (!this.active)
        return;
      const t = String(text ?? "").trim();
      if (!t)
        return;
      this.buffer.push(t);
      this.recent.push(t);
      this.trimRecent();
      const q = findAudienceQuestion(t);
      if (q)
        this.answer(q, false);
      const tm = this.timing();
      const words = wordCount(this.buffer.join(" "));
      const since = this.deps.now() - this.lastSummaryAt;
      if (words >= tm.maxWords || words >= tm.minWords && since >= tm.intervalMs)
        this.summarize();
      this.armFlush();
    }
    async aside(placeholder, run) {
      if (!this.active)
        return;
      const session = this.session;
      this.setScreen(answerScreen(placeholder, "…"));
      try {
        const qa = await run();
        if (session !== this.session || !qa)
          return;
        this.addNote({ t: this.deps.now(), kind: "you", q: qa.q, text: qa.a });
        this.setScreen(answerScreen(qa.q, qa.a));
        this.hold();
      } catch (e) {
        if (session !== this.session)
          return;
        this.showError(e);
      }
    }
    askUser(question) {
      if (!this.active || !question.trim())
        return;
      this.answer(question.trim(), true);
    }
    trimRecent() {
      let words = wordCount(this.recent.join(" "));
      while (this.recent.length > 1 && words > CONTEXT_WORDS) {
        words -= wordCount(this.recent.shift());
      }
    }
    timing() {
      return lectureTiming(this.deps.everySec?.() ?? DEFAULT_LECTURE_EVERY_SEC);
    }
    armFlush() {
      if (this.flushTimer != null)
        this.deps.clearTimer(this.flushTimer);
      const tm = this.timing();
      this.flushTimer = this.deps.setTimer(() => {
        this.flushTimer = null;
        if (this.active && wordCount(this.buffer.join(" ")) >= tm.flushMinWords)
          this.summarize();
      }, tm.flushMs);
    }
    allPoints() {
      return (this.record?.notes ?? []).filter((n) => n.kind === "point").map((n) => n.text);
    }
    async summarize() {
      if (this.summarizing || !this.buffer.length)
        return;
      const session = this.session;
      const chunk = this.buffer.join(" ");
      this.buffer = [];
      this.summarizing = true;
      this.lastSummaryAt = this.deps.now();
      const prev = this.allPoints().slice(-PREV_POINTS);
      const { system, user } = buildPointsPrompt(prev, chunk, this.deps.lang(), this.timing().maxPoints);
      try {
        const reply = await this.deps.complete(system, user);
        if (session !== this.session)
          return;
        const points = parsePoints(reply);
        if (!points.length) {
          this.deps.log("lecture", `Тезисов нет (${wordCount(chunk)} слов без сути)`);
          return;
        }
        const t = this.deps.now();
        for (const p of points)
          this.addNote({ t, kind: "point", text: p });
        this.deps.log("lecture", points.map((p) => "• " + p).join(" "));
        this.lastNewCount = points.length;
        if (this.deps.now() < this.holdUntil)
          this.pendingFeed = true;
        else
          this.setScreen(feedScreen(this.allPoints(), points.length));
      } catch (e) {
        if (session !== this.session)
          return;
        this.showError(e);
      } finally {
        if (session === this.session) {
          this.summarizing = false;
          if (wordCount(this.buffer.join(" ")) >= this.timing().maxWords)
            this.summarize();
        }
      }
    }
    async answer(question, fromUser) {
      if (this.answering) {
        if (fromUser || !this.pendingQuestion?.fromUser)
          this.pendingQuestion = { text: question, fromUser };
        return;
      }
      const session = this.session;
      this.answering = true;
      this.deps.log("lecture", `${fromUser ? "Ваш вопрос" : "Вопрос лектора"}: ${question}`);
      if (fromUser)
        this.setScreen(answerScreen(question, "…думаю"));
      const { system, user } = buildAnswerPrompt(this.recent.join(" "), question, fromUser ? detectLang(question) : this.deps.lang(), fromUser);
      try {
        const reply = await this.deps.complete(system, user);
        if (session !== this.session)
          return;
        const qa = parseAnswer(reply, question);
        if (!qa) {
          this.deps.log("lecture", "Организационный вопрос — без ответа");
          return;
        }
        this.addNote({ t: this.deps.now(), kind: fromUser ? "you" : "qa", q: qa.q, text: qa.a });
        this.deps.log("lecture", `→ ${qa.a}`);
        this.setScreen(answerScreen(qa.q, qa.a));
        this.hold();
      } catch (e) {
        if (session !== this.session)
          return;
        this.showError(e);
      } finally {
        if (session === this.session) {
          this.answering = false;
          const next = this.pendingQuestion;
          this.pendingQuestion = null;
          if (next)
            this.answer(next.text, next.fromUser);
        }
      }
    }
    hold() {
      this.holdUntil = this.deps.now() + LECTURE_ANSWER_HOLD_MS;
      if (this.holdTimer != null)
        this.deps.clearTimer(this.holdTimer);
      this.holdTimer = this.deps.setTimer(() => {
        this.holdTimer = null;
        this.holdUntil = 0;
        if (!this.active)
          return;
        if (this.pendingFeed) {
          this.setScreen(feedScreen(this.allPoints(), this.lastNewCount));
          this.pendingFeed = false;
        }
      }, LECTURE_ANSWER_HOLD_MS);
    }
    addNote(n) {
      if (!this.record)
        this.record = { startedAt: n.t, notes: [] };
      this.record.notes.push(n);
      if (this.record.notes.length > NOTES_MAX)
        this.record.notes.splice(0, this.record.notes.length - NOTES_MAX);
      this.deps.save(this.record);
      this.deps.onChange();
    }
    setScreen(text) {
      this.screen = text;
      this.deps.show(text);
      this.deps.onChange();
    }
    showError(e) {
      const human = this.deps.explainError(e);
      this.deps.log("error", `Лекция: ${human}`);
      const now = this.deps.now();
      if (now - this.lastErrorShownAt < ERROR_SHOW_EVERY_MS)
        return;
      this.lastErrorShownAt = now;
      if (now >= this.holdUntil)
        this.setScreen(human);
    }
    stopTimers() {
      for (const k of ["flushTimer", "holdTimer"]) {
        if (this[k] != null)
          this.deps.clearTimer(this[k]);
        this[k] = null;
      }
    }
  }

  // src/background/phrase.ts
  function buildPhrasePrompt(phrase, lang) {
    const target = PHRASE_LANG_NAME[lang];
    const system = [
      `Ты — переводчик в умных очках. Переведи слово или фразу на ${target} язык.`,
      "Дай самый употребительный вариант. Если у слова несколько значений или есть важный вариант — добавь ещё 1–2 через запятую, с короткой пометкой в скобках по-русски.",
      "Фраза распознана с речи и может содержать ошибки — угадай смысл.",
      "Не больше 12 слов. Без кавычек, Markdown, транскрипции и пояснений — только перевод."
    ].join(`
`);
    return { system, user: phrase.trim() };
  }
  function cleanPhraseReply(text) {
    return String(text ?? "").replace(/\*\*/g, "").replace(/^\s*(?:перевод|translation|ответ|answer)\s*[:：]\s*/i, "").split(/\n+/).map((l) => l.trim()).filter(Boolean).slice(0, 2).join(", ").replace(/^[«"“„]+|[»"”]+$/gu, "").trim();
  }

  // src/background/talk.ts
  var TALK_SHOW_MS = 30000;
  var TALK_DEDUPE_MS = 20000;
  var TALK_SETTLE_MS = 900;
  var TALK_QUOTE_WAIT_MS = 8000;
  var INTRO_MS = 5000;
  var CONTEXT_WORDS2 = 300;
  var PREV_HINTS = 4;
  var PREV_TIPS = 6;
  var TALK_TIP_MIN_SEC = 5;
  var TALK_TIP_MIN_WORDS = 6;
  var TALK_ANSWER_PRIORITY_MS = 1e4;
  var NOTES_MAX2 = 300;
  var ERROR_SHOW_EVERY_MS2 = 60000;
  var LEAD = new Set(["а", "и", "но", "так", "ну", "слушай", "скажи", "скажите", "кстати", "and", "so", "but", "well", "hey", "by"]);
  var RU_Q = new Set([
    "кто",
    "что",
    "когда",
    "где",
    "куда",
    "откуда",
    "почему",
    "зачем",
    "как",
    "сколько",
    "какой",
    "какая",
    "какое",
    "какие",
    "каким",
    "какую",
    "каких",
    "каком",
    "чей",
    "чья",
    "чье",
    "чьи",
    "скольких"
  ]);
  var EN_Q = new Set(["who", "what", "when", "where", "why", "how", "which", "whose", "whom"]);
  var SMALL_TALK = [
    "как дела",
    "как ты",
    "как вы",
    "как сам",
    "как жизнь",
    "что нового",
    "что делаешь",
    "что ты делаешь",
    "ты понял",
    "вы поняли",
    "понимаешь",
    "понятно",
    "правда",
    "серьезно",
    "да",
    "нет",
    "ну что",
    "что скажешь",
    "как тебе",
    "как вам",
    "ты где",
    "где ты",
    "когда встретимся",
    "что будем",
    "будешь",
    "хочешь",
    "how are you",
    "whats up",
    "what s up",
    "how is it going",
    "how s it going",
    "really",
    "right",
    "you know",
    "do you understand",
    "are you ok",
    "ok",
    "okay",
    "what do you want",
    "do you want",
    "shall we"
  ];
  var STRONG_CUES = [
    "это",
    "это значит",
    "означает",
    "называется",
    "является",
    "родился в",
    "родилась в",
    "умер в",
    "умерла в",
    "в году",
    "равен",
    "равна",
    "равно",
    "составляет",
    "то есть",
    "а именно",
    "это когда",
    "means",
    "is called",
    "was born in",
    "born in",
    "died in",
    "equals",
    "namely",
    "which is"
  ];
  var WEAK_CUES = [
    "значит",
    "являлся",
    "являлась",
    "был",
    "была",
    "было",
    "были",
    "родился",
    "родилась",
    "году",
    "около",
    "примерно",
    "is",
    "are",
    "was",
    "were",
    "about",
    "around",
    "approximately",
    "in the year",
    "is basically"
  ];
  function sentencesOf(text) {
    return String(text ?? "").replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  }
  function contentWords(n) {
    const w = n.split(" ").filter(Boolean);
    let i = 0;
    while (i < 2 && i < w.length - 1 && LEAD.has(w[i]))
      i++;
    return w.slice(i);
  }
  var ENDS_WITH_QUESTION = /\?["»”')\s]*$/;
  function questionIn(s) {
    const words = contentWords(normalize(s));
    if (words.length < 3)
      return null;
    if (parsePhraseRequest(s))
      return null;
    const n = words.join(" ");
    if (SMALL_TALK.some((st) => n === st || n.startsWith(st + " ")))
      return null;
    const asked = ENDS_WITH_QUESTION.test(s);
    const open = !/(?<!\.)[.!]["»”')\s]*$/.test(s);
    const interrogative = open && (RU_Q.has(words[0]) || EN_Q.has(words[0]) || words[1] === "ли") && words.length <= 14;
    return asked || interrogative ? { kind: "question", text: s } : null;
  }
  function finishedQuestions(text) {
    return sentencesOf(text).filter((s) => ENDS_WITH_QUESTION.test(s)).map(questionIn).filter((t) => t !== null);
  }
  var TRAILING_FILLERS = new Set(["ну", "э", "эм", "ээ", "мм", "как", "бы", "вот", "типа", "uh", "um", "er", "like", "well"]);
  function findTalkTrigger(text) {
    const sentences = sentencesOf(text);
    for (let i = sentences.length - 1;i >= 0; i--) {
      const q = questionIn(sentences[i]);
      if (q)
        return q;
    }
    const last = sentences.at(-1);
    if (last) {
      const words = normalize(last).split(" ").filter(Boolean);
      while (words.length > 3 && TRAILING_FILLERS.has(words[words.length - 1]))
        words.pop();
      const n = words.join(" ");
      const closed = /(?<!\.)[.!]["»”')\s]*$/.test(last);
      const cues = closed ? STRONG_CUES : [...STRONG_CUES, ...WEAK_CUES];
      if (n.split(" ").length >= 3 && cues.some((c) => n.endsWith(" " + c)))
        return { kind: "prompt", text: last };
    }
    return null;
  }
  function langName2(lang) {
    return lang === "en" ? "английском (English)" : "русском";
  }
  var QUOTE_CUES = [
    "как говорил",
    "как говорила",
    "как говорили",
    "как сказал",
    "как сказала",
    "как писал",
    "как писала",
    "как говорится",
    "как гласит",
    "как учил",
    "есть такая фраза",
    "есть фраза",
    "есть такое выражение",
    "есть выражение",
    "есть такая поговорка",
    "есть поговорка",
    "есть пословица",
    "как в поговорке",
    "как в пословице",
    "по словам",
    "цитата",
    "цитирую",
    "процитирую",
    "крылатая фраза",
    "известная фраза",
    "знаменитая фраза",
    "сказал однажды",
    "говорил однажды",
    "однажды сказал",
    "as the saying goes",
    "there s a saying",
    "there is a saying",
    "to quote",
    "famously said",
    "once said",
    "in the words of",
    "as they say"
  ];
  var AS_SAID = /\bas\s+(?:[\p{L}.'-]+\s+){1,3}(?:said|says|wrote|put it)\b/iu;
  var QUOTE_MIN_WORDS = 4;
  function findQuote(text) {
    const t = String(text ?? "").replace(/\s+/g, " ").trim();
    if (!t)
      return null;
    const quoted = /[«“„"]([^»”"]{8,})[»”"]/u.exec(t);
    if (quoted && wordCount(quoted[1]) >= QUOTE_MIN_WORDS)
      return { text: t, complete: true };
    const words = normalize(t).split(" ").filter(Boolean);
    const padded = ` ${words.join(" ")} `;
    let end = -1;
    for (const c of QUOTE_CUES) {
      const i = padded.indexOf(` ${c} `);
      if (i < 0)
        continue;
      const cueEnd = padded.slice(0, i).trim().split(" ").filter(Boolean).length + c.split(" ").length;
      if (end < 0 || cueEnd < end)
        end = cueEnd;
    }
    const as = AS_SAID.exec(t);
    if (as) {
      const cueEnd = normalize(t.slice(0, as.index + as[0].length)).split(" ").filter(Boolean).length;
      if (end < 0 || cueEnd < end)
        end = cueEnd;
    }
    if (end < 0)
      return null;
    return { text: t, complete: words.length - end >= QUOTE_MIN_WORDS };
  }
  function buildTalkPrompt(context, prevHints, trigger, fromUser, lang) {
    if (trigger.kind === "quote")
      return buildQuotePrompt(context, trigger.text, lang);
    const system = [
      "Ты — незаметный суфлёр в умных очках. Пользователь разговаривает с другим человеком; ты видишь распознанную речь (возможны ошибки, неизвестно, кто говорит). Ответ показывается на крошечном дисплее: 5 строк примерно по 30 символов.",
      "Если в последней реплике задан вопрос, требующий точной информации (люди, даты, места, числа, определения, термины, факты), дай эти сведения так, чтобы пользователь мог сразу сказать их вслух.",
      "Если пользователь начал объяснять и запнулся («Категорический императив — это…», «Он родился в…»), дай то, чем закончить фразу.",
      `Коротко: до 25 слов, сначала главное — даты, числа, суть. Пиши на ${langName2(lang)} языке.`,
      "Учитывай разговор и прошлые подсказки: «он», «а это…» обычно относятся к той же теме.",
      `Формат ровно две строки:
Q: <тема, до 6 слов>
A: <сведения>`,
      fromUser ? "Это прямой вопрос пользователя к тебе — ответь обязательно." : "Ответь ровно SKIP, только если реплика явно личная или бытовая (как дела, будешь кофе, где встретимся). Если сомневаешься — лучше дай короткую полезную справку по теме, чем промолчать.",
      "Без Markdown и вступлений."
    ].join(`
`);
    const ctx = context.trim() ? `Недавно в разговоре:
«${context.trim()}»

` : "";
    const prev = prevHints.length ? `Прошлые подсказки:
${prevHints.map((h) => `— ${h.q}: ${h.a}`).join(`
`)}

` : "";
    const label = fromUser ? "Вопрос пользователя" : trigger.kind === "prompt" ? "Последняя реплика (оборвана)" : "Последняя реплика";
    return { system, user: `${ctx}${prev}${label}: «${trigger.text.trim()}»` };
  }
  function buildQuotePrompt(context, text, lang) {
    const system = [
      "Ты — незаметный суфлёр в умных очках. В разговоре только что прозвучала цитата, афоризм, крылатая фраза или пословица (речь распознана автоматически, возможны ошибки). Ответ показывается на крошечном дисплее.",
      "Определи, чья это цитата и откуда: автор, произведение или речь, год. Если цитату приписали не тому человеку или авторство спорно — так и скажи и назови настоящего автора. Для пословицы — чья она (например, русская пословица) и её смысл в двух словах.",
      `Коротко: до 20 слов, на ${langName2(lang)} языке. Формат ровно две строки:
Q: <начало цитаты, до 6 слов>
A: <автор — источник, год>`,
      "Если это не цитата и не устойчивое выражение — ответь ровно SKIP. Без Markdown и вступлений."
    ].join(`
`);
    const ctx = context.trim() ? `Недавно в разговоре:
«${context.trim()}»

` : "";
    return { system, user: `${ctx}Реплика с цитатой: «${text.trim()}»` };
  }
  var TIP_LABELS = {
    ru: { fact: "Факт", answer: "Ответ", ask: "Спроси", say: "Скажи", quote: "Цитата" },
    en: { fact: "Fact", answer: "Answer", ask: "Ask", say: "Say", quote: "Quote" }
  };
  var TIP_BY_WORD = {
    факт: "fact",
    ответ: "answer",
    ответь: "answer",
    спроси: "ask",
    вопрос: "ask",
    скажи: "say",
    идея: "say",
    мысль: "say",
    fact: "fact",
    answer: "answer",
    ask: "ask",
    say: "say",
    idea: "say",
    цитата: "quote",
    quote: "quote"
  };
  function buildTipPrompt(context, prevTips, goal, lang) {
    const L = TIP_LABELS[lang];
    const system = [
      "Ты — суфлёр в умных очках и помогаешь пользователю вести живой разговор. Тебе дают свежую расшифровку речи (возможны ошибки, неизвестно, кто говорит). Подсказка показывается на крошечном дисплее и должна читаться за секунду.",
      `Цель пользователя в разговоре: ${goal.trim() || "поддерживать интересный и содержательный разговор"}.`,
      "Дай ОДНУ самую полезную прямо сейчас подсказку, до 15 слов, ровно в одной строке одного из видов:",
      `${L.quote}: <автор и источник — если только что прозвучала известная цитата, афоризм или крылатая фраза; это важнее остального>`,
      `${L.fact}: <точная справка о только что упомянутом человеке, месте, термине, событии, числе>`,
      `${L.answer}: <что ответить, если пользователю только что задали вопрос>`,
      `${L.ask}: <вопрос собеседнику, который продвинет разговор к цели или углубит тему>`,
      `${L.say}: <мысль, аргумент или пример, который стоит сказать сейчас>`,
      "Опирайся на последние реплики. Не повторяй прошлые подсказки. Факты — только точные.",
      `Пиши на ${lang === "en" ? "английском (English)" : "русском"} языке. Без Markdown и пояснений.`,
      "Если сейчас добавить нечего (пауза, бытовая мелочь, всё уже подсказано) — ответь ровно SKIP."
    ].join(`
`);
    const prev = prevTips.length ? `Прошлые подсказки:
${prevTips.map((t) => "— " + t).join(`
`)}

` : "";
    return { system, user: `${prev}Разговор (последнее — внизу):
«${context.trim()}»` };
  }
  function parseTip(text) {
    const t = String(text ?? "").trim();
    if (!t || /^\s*skip\b/i.test(t))
      return null;
    const m = /^\s*[•*\-–—]?\s*([A-Za-zА-Яа-яЁё]+)\s*[:：]\s*(.+)$/m.exec(t);
    if (!m)
      return null;
    const label = TIP_BY_WORD[m[1].toLowerCase()];
    const body = m[2].replace(/\*\*/g, "").trim();
    if (!label || !body || /^skip\b/i.test(body))
      return null;
    return { label, text: body };
  }
  function tipLine(label, text, lang) {
    return `${TIP_LABELS[lang][label]}: ${text}`;
  }

  class Talk {
    deps;
    active = false;
    record;
    screen = "";
    session = 0;
    recent = [];
    interim = "";
    settleTimer = null;
    quoteWait = null;
    handled = [];
    qBusy = false;
    qPending = null;
    tipBusy = false;
    lastTipAt = 0;
    wordsSinceTip = 0;
    lastAnswerAt = -Infinity;
    feed = [];
    feedSeq = 0;
    screenTimer = null;
    lastErrorShownAt = -Infinity;
    constructor(deps, saved = null) {
      this.deps = deps;
      this.record = saved;
    }
    start(intro) {
      this.session++;
      this.active = true;
      this.recent = [];
      this.interim = "";
      this.cancelSettle();
      this.handled = [];
      this.qBusy = false;
      this.qPending = null;
      this.tipBusy = false;
      this.lastTipAt = this.deps.now();
      this.wordsSinceTip = 0;
      this.lastAnswerAt = -Infinity;
      this.feed = [];
      const prev = this.record;
      const resume = Boolean(prev?.endedAt && this.deps.now() - prev.endedAt < LECTURE_RESUME_MS);
      if (resume && prev)
        delete prev.endedAt;
      else
        this.record = { startedAt: this.deps.now(), notes: [] };
      this.deps.save(this.record);
      const goal = this.deps.goal?.().trim();
      const every = this.every();
      const ru = [
        "Режим беседы",
        "• ответы на вопросы с фактами",
        every ? `• подсказки примерно раз в ${every} с` : "• подскажу, если запнётесь",
        goal ? `• цель: ${goal}` : "Выключить: «стоп беседа»"
      ];
      const en = [
        "Conversation mode",
        "• answers to factual questions",
        every ? `• hints about every ${every} s` : "• a prompt when you trail off",
        goal ? `• goal: ${goal}` : "Stop: «стоп беседа»"
      ];
      this.paint(fitScreen((intro.en ? en : ru).join(`
`)), INTRO_MS);
      this.deps.log("talk", resume ? "Режим беседы включён — продолжаю прежний список" : "Режим беседы включён");
      this.deps.onChange();
    }
    stop() {
      const hints = this.record?.notes.length ?? 0;
      if (!this.active)
        return { hints };
      this.active = false;
      this.session++;
      this.cancelScreenTimer();
      this.cancelSettle();
      this.qPending = null;
      this.feed = [];
      this.screen = "";
      if (this.record) {
        this.record.endedAt = this.deps.now();
        this.deps.save(this.record);
      }
      this.deps.log("talk", `Режим беседы выключен: подсказок ${hints}`);
      this.deps.onChange();
      return { hints };
    }
    onInterim(text) {
      if (!this.active)
        return;
      const t = String(text ?? "").trim();
      if (!t || t === this.interim)
        return;
      this.interim = t;
      for (const q of finishedQuestions(t))
        this.request(q, "на лету");
      this.cancelSettle();
      this.settleTimer = this.deps.setTimer(() => {
        this.settleTimer = null;
        if (!this.active || this.interim !== t)
          return;
        const quote = findQuote(t);
        if (quote?.complete)
          return this.request({ kind: "quote", text: quote.text }, "пауза");
        if (quote)
          return;
        const trigger = findTalkTrigger(t);
        if (trigger)
          this.request(trigger, "пауза");
      }, TALK_SETTLE_MS);
      this.maybeTip();
    }
    onSpeech(text) {
      if (!this.active)
        return;
      const t = String(text ?? "").trim();
      if (!t)
        return;
      this.cancelSettle();
      this.interim = "";
      this.recent.push(t);
      let words = wordCount(this.recent.join(" "));
      while (this.recent.length > 1 && words > CONTEXT_WORDS2)
        words -= wordCount(this.recent.shift());
      this.wordsSinceTip += wordCount(t);
      const waiting = this.quoteWait && this.deps.now() < this.quoteWait.until ? this.quoteWait.text : "";
      this.quoteWait = null;
      const quote = findQuote(waiting ? `${waiting} ${t}` : t);
      if (quote?.complete)
        this.request({ kind: "quote", text: quote.text }, "");
      else if (quote)
        this.quoteWait = { text: quote.text, until: this.deps.now() + TALK_QUOTE_WAIT_MS };
      else {
        const trigger = findTalkTrigger(t);
        if (trigger)
          this.request(trigger, "");
      }
      this.maybeTip();
    }
    askUser(question) {
      if (!this.active || !question.trim())
        return;
      this.answer({ kind: "question", text: question.trim() }, true);
    }
    async aside(placeholder, run, joiner = ": ") {
      if (!this.active)
        return;
      const session = this.session;
      const id = this.push(`${placeholder} …`);
      try {
        const qa = await run();
        if (session !== this.session)
          return;
        if (!qa)
          return this.drop(id);
        this.addNote({ t: this.deps.now(), kind: "you", q: qa.q, text: qa.a });
        this.lastAnswerAt = this.deps.now();
        this.replace(id, `${qa.q}${joiner}${qa.a}`);
      } catch (e) {
        if (session !== this.session)
          return;
        this.drop(id);
        this.showError(e);
      }
    }
    request(trigger, via) {
      const n = contentWords(normalize(trigger.text)).join(" ");
      const now = this.deps.now();
      this.handled = this.handled.filter((h) => now - h.at < TALK_DEDUPE_MS);
      const same = (a, b) => a === b || Math.min(a.length, b.length) >= 10 && (a.includes(b) || b.includes(a));
      if (this.handled.some((h) => same(h.n, n)))
        return;
      this.handled.push({ n, at: now });
      if (via)
        this.deps.log("talk", `Услышал (${via}): ${trigger.text}`);
      this.answer(trigger, false);
    }
    async answer(trigger, fromUser) {
      if (this.qBusy) {
        if (fromUser || !this.qPending?.fromUser)
          this.qPending = { trigger, fromUser };
        return;
      }
      const session = this.session;
      this.qBusy = true;
      const what = fromUser ? "Ваш вопрос" : { question: "Вопрос", prompt: "Подсказать", quote: "Цитата" }[trigger.kind];
      this.deps.log("talk", `${what}: ${trigger.text}`);
      const placeholder = this.push(`${shorten(trigger.text, 40)} …`);
      const prev = (this.record?.notes ?? []).slice(-PREV_HINTS).map((x) => ({ q: x.q ?? "", a: x.text }));
      const context = [...this.recent, this.interim].filter(Boolean).join(" ");
      const { system, user } = buildTalkPrompt(context, prev, trigger, fromUser, detectLang(trigger.text));
      try {
        const reply = await this.deps.complete(system, user);
        if (session !== this.session)
          return;
        const qa = parseAnswer(reply, trigger.text);
        if (!qa) {
          this.deps.log("talk", "Подсказка не нужна");
          this.drop(placeholder);
          return;
        }
        const kind = fromUser ? "you" : { question: "qa", prompt: "hint", quote: "quote" }[trigger.kind];
        this.addNote({ t: this.deps.now(), kind, q: qa.q, text: qa.a });
        this.deps.log("talk", `→ ${qa.a}`);
        this.lastAnswerAt = this.deps.now();
        this.replace(placeholder, kind === "quote" ? `«${qa.q}» — ${qa.a}` : `${qa.q}: ${qa.a}`);
      } catch (e) {
        if (session !== this.session)
          return;
        this.drop(placeholder);
        this.showError(e);
      } finally {
        if (session === this.session) {
          this.qBusy = false;
          const next = this.qPending;
          this.qPending = null;
          if (next)
            this.answer(next.trigger, next.fromUser);
        }
      }
    }
    every() {
      const v = Math.round(Number(this.deps.everySec?.() ?? 0));
      return v > 0 ? Math.max(TALK_TIP_MIN_SEC, Math.min(120, v)) : 0;
    }
    maybeTip() {
      const every = this.every();
      if (!every || this.tipBusy)
        return;
      const words = this.wordsSinceTip + (this.interim ? wordCount(this.interim) : 0);
      if (words < TALK_TIP_MIN_WORDS || this.deps.now() - this.lastTipAt < every * 1000)
        return;
      this.tip();
    }
    async tip() {
      const session = this.session;
      this.tipBusy = true;
      this.lastTipAt = this.deps.now();
      this.wordsSinceTip = 0;
      const context = [...this.recent, this.interim].filter(Boolean).join(" ");
      const lang = detectLang(context.split(/\s+/).slice(-60).join(" "));
      const prevTips = (this.record?.notes ?? []).slice(-PREV_TIPS).map((n) => `${n.q}: ${n.text}`);
      const { system, user } = buildTipPrompt(context, prevTips, this.deps.goal?.() ?? "", lang);
      try {
        const reply = await this.deps.complete(system, user);
        if (session !== this.session)
          return;
        const tip = parseTip(reply);
        if (!tip) {
          this.deps.log("talk", "Подсказка по ходу: нечего добавить");
          return;
        }
        const line = tipLine(tip.label, tip.text, lang);
        const seen = (this.record?.notes ?? []).slice(-PREV_TIPS).some((n) => normalize(`${n.q}: ${n.text}`) === normalize(line));
        if (seen)
          return;
        this.addNote({ t: this.deps.now(), kind: "tip", q: TIP_LABELS[lang][tip.label], text: tip.text });
        this.deps.log("talk", `Подсказка по ходу — ${line}`);
        if (this.deps.now() - this.lastAnswerAt >= TALK_ANSWER_PRIORITY_MS)
          this.push(line);
      } catch (e) {
        if (session !== this.session)
          return;
        this.deps.log("error", `Беседа: ${this.deps.explainError(e)}`);
      } finally {
        if (session === this.session)
          this.tipBusy = false;
      }
    }
    push(text) {
      const id = ++this.feedSeq;
      this.feed.push({ id, text });
      if (this.feed.length > 6)
        this.feed.splice(0, this.feed.length - 6);
      this.renderFeed();
      return id;
    }
    replace(id, text) {
      const item = this.feed.find((f) => f.id === id);
      if (item) {
        this.feed = this.feed.filter((f) => f.id !== id);
        this.feed.push({ id, text });
      } else
        this.feed.push({ id: ++this.feedSeq, text });
      this.renderFeed();
    }
    drop(id) {
      const before = this.feed.length;
      this.feed = this.feed.filter((f) => f.id !== id);
      if (this.feed.length !== before)
        this.renderFeed();
    }
    renderFeed() {
      if (!this.feed.length)
        return this.paint("");
      this.paint(feedScreen(this.feed.map((f) => f.text), 1), TALK_SHOW_MS);
    }
    addNote(n) {
      if (!this.record)
        this.record = { startedAt: n.t, notes: [] };
      this.record.notes.push(n);
      if (this.record.notes.length > NOTES_MAX2)
        this.record.notes.splice(0, this.record.notes.length - NOTES_MAX2);
      this.deps.save(this.record);
      this.deps.onChange();
    }
    paint(text, forMs = 0) {
      this.cancelScreenTimer();
      this.screen = text;
      if (text)
        this.deps.show(text);
      else
        this.deps.clear();
      if (forMs > 0 && text) {
        this.screenTimer = this.deps.setTimer(() => {
          this.screenTimer = null;
          if (this.active && this.screen === text) {
            this.screen = "";
            this.feed = [];
            this.deps.clear();
            this.deps.onChange();
          }
        }, forMs);
      }
      this.deps.onChange();
    }
    cancelScreenTimer() {
      if (this.screenTimer != null)
        this.deps.clearTimer(this.screenTimer);
      this.screenTimer = null;
    }
    cancelSettle() {
      if (this.settleTimer != null)
        this.deps.clearTimer(this.settleTimer);
      this.settleTimer = null;
    }
    showError(e) {
      const human = this.deps.explainError(e);
      this.deps.log("error", `Беседа: ${human}`);
      const now = this.deps.now();
      if (now - this.lastErrorShownAt < ERROR_SHOW_EVERY_MS2)
        return;
      this.lastErrorShownAt = now;
      this.push(human);
    }
  }
  function shorten(s, max) {
    const t = s.replace(/\s+/g, " ").trim();
    return t.length <= max ? t : t.slice(0, max).replace(/\s+\S*$/, "") + "…";
  }

  // src/background/store.ts
  var SETTINGS_VERSION = 2;
  var OLD_DEFAULT_WAKE = ["вопрос", "ассистент", "джипити", "чат джипити", "чат gpt", "chat gpt", "chatgpt", "гпт"];
  var DEFAULT_SETTINGS = {
    provider: "openai",
    apiKey: "",
    anthropicKey: "",
    geminiKey: "",
    model: "gpt-6.1-terra",
    anthropicModel: "claude-haiku-5-5",
    geminiModel: "gemini-3.8-flash",
    effort: "auto",
    aboutMe: "",
    instructions: "",
    wakeWords: ["вопрос", "ассистент", "джипити", "чат джипити", "чат gpt", "chat gpt", "chatgpt", "гпт", "question"],
    listenMode: "wake",
    sttLanguage: "auto",
    answerWords: 60,
    historyMessages: 20,
    webSearch: false,
    autoAdvanceSec: 0,
    clearAfterSec: 90,
    headNod: true,
    followUpSec: 0,
    translateTo: "ru-RU",
    lectureEverySec: 15,
    talkEverySec: 10,
    talkGoal: "",
    v: SETTINGS_VERSION
  };
  function migrateSettings(raw) {
    if (!raw)
      return raw;
    const r = { ...raw };
    if ((r.v ?? 1) < 2) {
      if (r.sttLanguage === "ru-RU" || r.sttLanguage === undefined)
        r.sttLanguage = "auto";
      const wake = Array.isArray(r.wakeWords) ? r.wakeWords : null;
      if (wake && wake.length === OLD_DEFAULT_WAKE.length && wake.every((w, i) => w === OLD_DEFAULT_WAKE[i])) {
        r.wakeWords = [...wake, "question"];
      }
    }
    r.v = SETTINGS_VERSION;
    return r;
  }
  var STORE_PREFIX = "~g1:";
  var PROBE_KEY = "g1gpt.probe";
  var SETTINGS_KEY = "g1gpt.settings.v1";
  var HISTORY_KEY = "g1gpt.history.v1";
  var LECTURE_KEY = "g1gpt.lecture.v1";
  var TALK_KEY = "g1gpt.talk.v1";
  function clampInt(v, min, max, dflt) {
    const n = typeof v === "number" ? v : parseInt(String(v), 10);
    if (!Number.isFinite(n))
      return dflt;
    return Math.min(max, Math.max(min, Math.round(n)));
  }
  function normalizeSettings(raw, base = DEFAULT_SETTINGS) {
    const r = raw ?? {};
    const pick = (k) => r[k] !== undefined ? r[k] : base[k];
    const wake = pick("wakeWords");
    const wakeWords = (Array.isArray(wake) ? wake : String(wake).split(",")).map((w) => String(w).trim()).filter(Boolean).slice(0, 20);
    const listenMode = pick("listenMode");
    const effort = pick("effort");
    const stt = pick("sttLanguage");
    const provider = pick("provider");
    return {
      provider: provider === "anthropic" || provider === "gemini" ? provider : "openai",
      apiKey: String(pick("apiKey") ?? "").trim(),
      anthropicKey: String(pick("anthropicKey") ?? "").trim(),
      geminiKey: String(pick("geminiKey") ?? "").trim(),
      model: String(pick("model") || DEFAULT_SETTINGS.model).trim(),
      anthropicModel: String(pick("anthropicModel") || DEFAULT_SETTINGS.anthropicModel).trim(),
      geminiModel: String(pick("geminiModel") || DEFAULT_SETTINGS.geminiModel).trim(),
      effort: ["auto", "none", "low", "medium", "high"].includes(effort) ? effort : "auto",
      aboutMe: String(pick("aboutMe") ?? "").slice(0, 4000),
      instructions: String(pick("instructions") ?? "").slice(0, 4000),
      wakeWords: wakeWords.length ? wakeWords : DEFAULT_SETTINGS.wakeWords,
      listenMode: ["wake", "always", "off"].includes(listenMode) ? listenMode : "wake",
      sttLanguage: stt === "ru-RU" ? "ru-RU" : "auto",
      answerWords: clampInt(pick("answerWords"), 15, 400, DEFAULT_SETTINGS.answerWords),
      historyMessages: clampInt(pick("historyMessages"), 0, 60, DEFAULT_SETTINGS.historyMessages),
      webSearch: Boolean(pick("webSearch")),
      autoAdvanceSec: clampInt(pick("autoAdvanceSec"), 0, 60, 0),
      clearAfterSec: clampInt(pick("clearAfterSec"), 0, 3600, DEFAULT_SETTINGS.clearAfterSec),
      headNod: pick("headNod") !== false,
      followUpSec: clampInt(pick("followUpSec"), 0, 120, 0),
      translateTo: pick("translateTo") === "en-US" ? "en-US" : "ru-RU",
      lectureEverySec: clampInt(pick("lectureEverySec"), 10, 60, DEFAULT_SETTINGS.lectureEverySec),
      talkEverySec: clampInt(pick("talkEverySec"), 0, 60, DEFAULT_SETTINGS.talkEverySec),
      talkGoal: String(pick("talkGoal") ?? "").trim().slice(0, 300),
      v: SETTINGS_VERSION
    };
  }

  class Store {
    kv;
    constructor(kv) {
      this.kv = kv;
    }
    read(key) {
      try {
        const s = this.kv?.getItem(key);
        if (typeof s !== "string" || !s)
          return null;
        return JSON.parse(s.startsWith(STORE_PREFIX) ? s.slice(STORE_PREFIX.length) : s);
      } catch {
        return null;
      }
    }
    write(key, value) {
      try {
        this.kv?.setItem(key, STORE_PREFIX + JSON.stringify(value));
      } catch {}
    }
    selfTest() {
      if (!this.kv)
        return false;
      try {
        this.write(PROBE_KEY, { ok: 1, at: Date.now() });
        return this.read(PROBE_KEY)?.ok === 1;
      } catch {
        return false;
      }
    }
    loadSettings() {
      return normalizeSettings(migrateSettings(this.read(SETTINGS_KEY)));
    }
    saveSettings(s) {
      this.write(SETTINGS_KEY, s);
    }
    loadHistory() {
      const h = this.read(HISTORY_KEY);
      return Array.isArray(h) ? h.filter((m) => m && typeof m.content === "string") : [];
    }
    saveHistory(h) {
      this.write(HISTORY_KEY, h.slice(-200));
    }
    loadLecture() {
      const r = this.read(LECTURE_KEY);
      return r && typeof r.startedAt === "number" && Array.isArray(r.notes) ? r : null;
    }
    saveLecture(r) {
      this.write(LECTURE_KEY, r);
    }
    loadTalk() {
      const r = this.read(TALK_KEY);
      return r && typeof r.startedAt === "number" && Array.isArray(r.notes) ? r : null;
    }
    saveTalk(r) {
      this.write(TALK_KEY, r);
    }
  }

  // src/background/assistant.ts
  var SILENCE_MS = 1600;
  var TRANSLATE_IDLE_MS = 20000;
  var TRANSLATE_RENDER_MS = 350;
  var TRANSLATE_KEEP = 12;
  function primaryLang(tag) {
    return String(tag ?? "").toLowerCase().split(/[-_]/)[0];
  }
  function isPassthrough(ev, target) {
    const src = primaryLang(ev.sourceLanguage);
    if (src && src !== "auto")
      return src === primaryLang(target);
    return !ev.originalText;
  }
  var REPLY_WINDOW_SEC = 25;
  function endsWithQuestion(text) {
    const t = String(text ?? "").trim().replace(/[\s»")\]]+$/, "");
    return t.endsWith("?");
  }
  var WAKE_WAIT_MS = 9000;
  var INTERIM_THROTTLE_MS = 450;
  var LOG_MAX = 150;
  var NOD_DEBOUNCE_MS = 1200;
  var HEAD_UP_HIDES_MS = 4000;
  var DASHBOARD_WARN_EVERY_MS = 60000;
  var DASHBOARD_WARNING = "Mentra считает, что голова поднята, и показывает свою панель (время, заряд) вместо ответа. " + "Опустите голову. Если не помогает: Mentra → Settings → Dashboard → выключите Contextual Dashboard " + "или увеличьте Adjust Head-Up Angle.";
  var PHRASE_WAIT_MS = 8000;

  class Assistant {
    deps;
    settings;
    history;
    phase = "idle";
    pages = [];
    page = 0;
    lastTranscript = "";
    lastQuestion = "";
    lastAnswer = "";
    lastError = "";
    glassesConnected = null;
    log = [];
    committed = [];
    interim = "";
    silenceTimer = null;
    wakeTimer = null;
    pageTimer = null;
    clearTimer_ = null;
    lastInterimShow = 0;
    requestSeq = 0;
    followUpUntil = 0;
    captureIsReply = false;
    captureProvider = null;
    lastProvider = null;
    translateUnsub = null;
    trFinals = [];
    trInterim = null;
    trLastRender = 0;
    trRenderTimer = null;
    trIdleTimer = null;
    translationScreen = "";
    autoHidden = false;
    lastNodAt = 0;
    headUp = false;
    headUpSince = 0;
    lastDashboardWarnAt = -Infinity;
    displayChecked = false;
    phraseWait = null;
    lecture;
    talk;
    now;
    setTimer;
    clearTimerFn;
    constructor(deps) {
      this.deps = deps;
      this.now = deps.now ?? Date.now;
      this.setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
      this.clearTimerFn = deps.clearTimer ?? ((id) => clearTimeout(id));
      this.settings = deps.store.loadSettings();
      this.history = deps.store.loadHistory();
      this.lecture = new Lecture({
        complete: (system, user) => this.completeOnce(system, user),
        explainError: (e) => {
          const err = e;
          return explainLLMError(err?.provider ?? asProvider(this.settings.provider), Number(err?.status) || 0, String(err?.code ?? ""), String(err?.message ?? ""));
        },
        show: (t) => this.show(t),
        clear: () => this.clearDisplay(),
        log: (kind, msg) => this.addLog(kind, msg),
        lang: () => this.settings.translateTo === "en-US" ? "en" : "ru",
        everySec: () => this.settings.lectureEverySec,
        now: () => this.now(),
        setTimer: (fn, ms) => this.setTimer(fn, ms),
        clearTimer: (id) => this.clearTimerFn(id),
        save: (r) => this.deps.store.saveLecture(r),
        onChange: () => this.changed()
      }, deps.store.loadLecture());
      this.talk = new Talk({
        complete: (system, user) => this.completeOnce(system, user),
        explainError: (e) => {
          const err = e;
          return explainLLMError(err?.provider ?? asProvider(this.settings.provider), Number(err?.status) || 0, String(err?.code ?? ""), String(err?.message ?? ""));
        },
        show: (t) => this.show(t),
        clear: () => this.clearDisplay(),
        log: (kind, msg) => this.addLog(kind, msg),
        now: () => this.now(),
        setTimer: (fn, ms) => this.setTimer(fn, ms),
        clearTimer: (id) => this.clearTimerFn(id),
        save: (r) => this.deps.store.saveTalk(r),
        onChange: () => this.changed(),
        everySec: () => this.settings.talkEverySec,
        goal: () => this.settings.talkGoal
      }, deps.store.loadTalk());
    }
    async completeOnce(system, user) {
      const provider = asProvider(this.settings.provider);
      const quick = {
        ...this.settings,
        webSearch: false,
        historyMessages: 0,
        answerWords: 40,
        effort: this.settings.effort === "medium" || this.settings.effort === "high" ? "low" : this.settings.effort
      };
      const res = await askLLM(this.deps.fetch, quick, provider, [], user, {
        system,
        timeoutMs: 30000,
        setTimer: (fn, ms) => this.setTimer(fn, ms),
        now: this.now
      });
      const usage = res.usage ? `, токены ${res.usage.input_tokens ?? "?"}→${res.usage.output_tokens ?? "?"}` : "";
      this.addLog("openai", `${PROVIDERS[provider].label}: ${(res.ms / 1000).toFixed(1)} с (${res.model}${usage})`);
      return res.text;
    }
    addLog(kind, msg) {
      this.log.push({ t: this.now(), kind, msg: msg.slice(0, 400) });
      if (this.log.length > LOG_MAX)
        this.log.splice(0, this.log.length - LOG_MAX);
      this.changed();
    }
    changed() {
      try {
        this.deps.onChange?.();
      } catch {}
    }
    show(text) {
      let r;
      try {
        r = this.deps.show(text);
      } catch (e) {
        this.addLog("error", `Дисплей: ${String(e?.message ?? e)}`);
        return;
      }
      this.warnIfDashboard();
      if (r && typeof r.then === "function") {
        r.then((res) => {
          if (!res)
            return;
          if (res.status === "blocked") {
            this.addLog("display", `Дисплей занят другим приложением${res.reason ? ": " + res.reason : ""}`);
          } else if (!this.displayChecked && res.status) {
            this.displayChecked = true;
            this.addLog("display", `Дисплей: ${res.status}${res.degraded ? " (текстовый режим G1)" : ""}`);
          }
        }, () => {});
      }
    }
    clearDisplay() {
      try {
        this.deps.clear();
      } catch {}
    }
    cancelTimer(name) {
      if (this[name] != null) {
        this.clearTimerFn(this[name]);
        this[name] = null;
      }
    }
    updateSettings(patch) {
      const merged = normalizeSettings({ ...this.settings, ...patch });
      if (patch.apiKey === undefined || patch.apiKey === null)
        merged.apiKey = this.settings.apiKey;
      if (patch.anthropicKey === undefined || patch.anthropicKey === null)
        merged.anthropicKey = this.settings.anthropicKey;
      if (patch.geminiKey === undefined || patch.geminiKey === null)
        merged.geminiKey = this.settings.geminiKey;
      this.settings = merged;
      this.deps.store.saveSettings(merged);
      this.addLog("info", "Настройки сохранены");
      return merged;
    }
    resetConversation(announce = true) {
      this.history = [];
      this.deps.store.saveHistory(this.history);
      this.pages = [];
      this.page = 0;
      this.lastAnswer = "";
      this.followUpUntil = 0;
      this.addLog("cmd", "Новый разговор: контекст очищен");
      if (announce)
        this.flash(`Новый разговор.
Контекст очищен.`, 2500);
    }
    flash(text, ms) {
      this.cancelTimer("clearTimer_");
      this.show(fitScreen(text));
      this.clearTimer_ = this.setTimer(() => {
        this.clearTimer_ = null;
        if (this.phase === "idle")
          this.clearDisplay();
        else if (this.phase === "answering")
          this.showPage(this.page);
        else if (this.phase === "lecture")
          this.lecture.screen ? this.show(this.lecture.screen) : this.clearDisplay();
        else if (this.phase === "talk")
          this.talk.screen ? this.show(this.talk.screen) : this.clearDisplay();
      }, ms);
    }
    wakeWords() {
      return [...this.settings.wakeWords, ...AI_WAKE_WORDS];
    }
    wake(t) {
      return detectWake(t, this.wakeWords());
    }
    onTranscript(text, isFinal) {
      if (this.settings.listenMode === "off")
        return;
      const t = String(text ?? "").trim();
      if (!t)
        return;
      if (isFinal) {
        this.lastTranscript = t;
        this.addLog("stt", t);
      }
      if (this.phase === "translating") {
        if (isFinal)
          this.onTranscriptWhileTranslating(t);
        return;
      }
      if (this.phase === "lecture") {
        if (isFinal)
          this.onTranscriptWhileLecture(t);
        return;
      }
      if (this.phase === "talk") {
        if (isFinal)
          this.onTranscriptWhileTalk(t);
        else if (!this.wake(t).matched)
          this.talk.onInterim(t);
        return;
      }
      if (this.phase === "capturing") {
        this.captureText(t, isFinal);
        return;
      }
      if (!isFinal) {
        const inReplyWindow = this.now() < this.followUpUntil && this.phase === "answering";
        const w = this.wake(t);
        if (this.settings.listenMode === "wake" && w.matched || inReplyWindow && isMeaningful(t) && !parseCommand(t) && !isCommandPrefix(t)) {
          if (inReplyWindow && !w.matched)
            this.addLog("wake", "Ответ на встречный вопрос / уточнение без активатора");
          this.startCapture(true, inReplyWindow && !w.matched);
          this.captureProvider = w.matched ? aiForWakePhrase(w.phrase) : inReplyWindow ? this.lastProvider : null;
          this.captureText(t, false);
        }
        return;
      }
      const wake = this.wake(t);
      const body = wake.matched ? wake.rest : t;
      if (this.tryPhrase(body))
        return;
      if (parseTranslateCommand(body) === "start") {
        this.startTranslation("voice");
        return;
      }
      if (parseLectureCommand(body) === "start") {
        this.startLecture("voice");
        return;
      }
      if (parseTalkCommand(body) === "start") {
        this.startTalk("voice");
        return;
      }
      if (wake.matched) {
        const goal = goalIn(t);
        if (goal !== null)
          return this.setGoal(goal);
      }
      const switchTo = parseSwitchCommand(body);
      if (switchTo) {
        this.switchProvider(switchTo, "voice");
        return;
      }
      const cmd = parseCommand(body);
      if (cmd && (wake.matched || this.commandRelevant(cmd))) {
        this.command(cmd, "voice");
        return;
      }
      const followUp = this.now() < this.followUpUntil;
      const accept = wake.matched || this.settings.listenMode === "always" || followUp && this.phase !== "thinking";
      if (!accept)
        return;
      const named = wake.matched ? aiForWakePhrase(wake.phrase) : null;
      if (wake.matched)
        this.addLog("wake", `${named ? `Вопрос для ${PROVIDERS[named].label}` : "Фраза-активатор"}${wake.rest ? `: «${wake.rest}»` : ""}`);
      else if (followUp)
        this.addLog("wake", "Уточнение без активатора");
      const shortReplyOk = !wake.matched && followUp && normalize(body).length > 0;
      if (!body || !isMeaningful(body) && !shortReplyOk) {
        if (wake.matched) {
          this.startCapture(false);
          this.captureProvider = named;
        }
        return;
      }
      this.startCapture(false, !wake.matched && followUp);
      this.captureProvider = named ?? (!wake.matched && followUp ? this.lastProvider : null);
      this.captureText(body, true);
    }
    commandRelevant(cmd) {
      if (cmd === "reset")
        return true;
      if (cmd === "cancel")
        return this.phase === "thinking" || this.phase === "answering";
      if (cmd === "hide")
        return this.phase === "answering";
      return this.pages.length > 0 && (this.phase === "answering" || this.phase === "idle" && this.autoHidden || cmd === "repeat");
    }
    onTouch(kind) {
      this.addLog("touch", kind);
      if (this.phase === "lecture" || this.phase === "talk")
        return;
      if (kind === "single_tap" || kind === "swipe_down") {
        if (this.pages.length)
          this.command("next", "touch");
      } else if (kind === "double_tap" || kind === "swipe_up") {
        if (this.pages.length)
          this.command("prev", "touch");
      } else if (kind === "long_press" || kind === "triple_tap") {
        if (this.phase !== "capturing")
          this.startCapture(false);
      }
    }
    startCapture(fromInterim, isReply = false) {
      if (this.phase === "thinking")
        this.requestSeq++;
      this.phase = "capturing";
      this.captureIsReply = isReply;
      this.captureProvider = null;
      this.committed = [];
      this.interim = "";
      this.cancelTimer("pageTimer");
      this.cancelTimer("clearTimer_");
      this.cancelTimer("silenceTimer");
      this.cancelTimer("wakeTimer");
      this.wakeTimer = this.setTimer(() => {
        this.wakeTimer = null;
        if (this.phase === "capturing" && !this.captured()) {
          this.addLog("info", "Вопрос не прозвучал — жду активатор снова");
          this.phase = "idle";
          this.clearDisplay();
          this.changed();
        }
      }, WAKE_WAIT_MS);
      this.show("Слушаю…");
      if (!fromInterim)
        this.addLog("info", "Слушаю вопрос");
      this.changed();
    }
    stripWake(t) {
      const w = this.wake(t);
      if (!w.matched)
        return t;
      const named = aiForWakePhrase(w.phrase);
      if (named)
        this.captureProvider = named;
      return w.rest;
    }
    captured() {
      return [...this.committed, this.interim].map((s) => s.trim()).filter(Boolean).join(" ").trim();
    }
    captureText(t, isFinal) {
      const clean = this.stripWake(t);
      if (isFinal) {
        const sw = this.committed.length === 0 ? parseSwitchCommand(clean) : null;
        if (sw) {
          this.cancelTimer("silenceTimer");
          this.cancelTimer("wakeTimer");
          this.interim = "";
          this.phase = this.pages.length ? "answering" : "idle";
          this.switchProvider(sw, "voice");
          return;
        }
        if (this.committed.length === 0 && parseTranslateCommand(clean) === "start") {
          this.cancelTimer("silenceTimer");
          this.cancelTimer("wakeTimer");
          this.interim = "";
          this.startTranslation("voice");
          return;
        }
        if (this.committed.length === 0 && parseLectureCommand(clean) === "start") {
          this.cancelTimer("silenceTimer");
          this.cancelTimer("wakeTimer");
          this.interim = "";
          this.startLecture("voice");
          return;
        }
        if (this.committed.length === 0 && parseTalkCommand(clean) === "start") {
          this.cancelTimer("silenceTimer");
          this.cancelTimer("wakeTimer");
          this.interim = "";
          this.startTalk("voice");
          return;
        }
        if (this.committed.length === 0) {
          const back = this.pages.length ? "answering" : "idle";
          if (parsePhraseRequest(clean)) {
            this.cancelTimer("silenceTimer");
            this.cancelTimer("wakeTimer");
            this.interim = "";
            this.phase = back;
            this.tryPhrase(clean);
            return;
          }
        }
        const goal = this.committed.length === 0 ? goalIn(t) : null;
        if (goal !== null) {
          this.cancelTimer("silenceTimer");
          this.cancelTimer("wakeTimer");
          this.interim = "";
          this.phase = this.pages.length ? "answering" : "idle";
          this.setGoal(goal);
          return;
        }
        const cmd = parseCommand(clean);
        if (cmd && (this.committed.length === 0 || cmd === "cancel" || cmd === "hide")) {
          this.cancelTimer("silenceTimer");
          this.cancelTimer("wakeTimer");
          this.committed = [];
          this.interim = "";
          this.phase = this.pages.length ? "answering" : "idle";
          this.command(cmd, "voice");
          return;
        }
        if (clean)
          this.committed.push(clean);
        this.interim = "";
      } else {
        this.interim = clean;
      }
      const q = this.captured();
      if (q) {
        this.cancelTimer("wakeTimer");
        const now = this.now();
        if (isFinal || now - this.lastInterimShow > INTERIM_THROTTLE_MS) {
          this.lastInterimShow = now;
          this.show(fitScreen(`» ${q}`));
        }
      }
      this.cancelTimer("silenceTimer");
      if (q) {
        this.silenceTimer = this.setTimer(() => {
          this.silenceTimer = null;
          this.submitCapture();
        }, isFinal ? SILENCE_MS : SILENCE_MS + 1200);
      }
      this.changed();
    }
    submitCapture() {
      if (this.phase !== "capturing")
        return;
      const q = this.captured();
      this.committed = [];
      this.interim = "";
      this.cancelTimer("wakeTimer");
      if (!isMeaningful(q) && !(this.captureIsReply && normalize(q).length > 0)) {
        this.phase = "idle";
        this.clearDisplay();
        this.changed();
        return;
      }
      this.ask(q, "voice", this.captureProvider ?? undefined);
    }
    switchProvider(p, source) {
      this.updateSettings({ provider: p });
      const name = displayName(this.settings, p);
      const hasKey = Boolean(keyFor(this.settings, p));
      this.addLog("cmd", `Теперь отвечает ${name} (${source === "ui" ? "с телефона" : "голосом"})`);
      if (source === "voice" || this.phase === "idle") {
        this.flash(hasKey ? `Теперь отвечает ${name}.` : `Теперь отвечает ${name}.
Нет ключа ${PROVIDERS[p].label} — добавьте в приложении.`, 3000);
      }
    }
    async ask(question, source, providerOverride) {
      const q = question.trim();
      if (!q)
        return;
      if (this.phase === "lecture" || this.phase === "talk") {
        this.addLog("ask", `${source === "ui" ? "[с телефона] " : ""}${q}`);
        if (this.phase === "lecture")
          this.lecture.askUser(q);
        else
          this.talk.askUser(q);
        return;
      }
      if (this.phase === "translating")
        this.stopTranslation("question", false);
      const seq = ++this.requestSeq;
      this.cancelTimer("silenceTimer");
      this.cancelTimer("wakeTimer");
      this.cancelTimer("pageTimer");
      this.cancelTimer("clearTimer_");
      this.phase = "thinking";
      this.lastQuestion = q;
      this.lastError = "";
      const provider = providerOverride ?? asProvider(this.settings.provider);
      const label = PROVIDERS[provider].label;
      this.addLog("ask", `${source === "ui" ? "[с телефона] " : ""}${providerOverride ? `[${label}] ` : ""}${q}`);
      if (!keyFor(this.settings, provider)) {
        this.fail(explainLLMError(provider, 401, "no_key", ""), seq);
        return;
      }
      this.show(fitScreen(`» ${q}
…${providerOverride || provider !== "openai" ? label + " " : ""}думает`));
      try {
        const res = await askLLM(this.deps.fetch, this.settings, provider, this.history, q, {
          setTimer: (fn, ms) => this.setTimer(fn, ms),
          now: this.now
        });
        if (seq !== this.requestSeq) {
          this.addLog("info", "Ответ на отменённый вопрос пропущен");
          return;
        }
        const usage = res.usage ? `, токены ${res.usage.input_tokens ?? "?"}→${res.usage.output_tokens ?? "?"}` : "";
        this.addLog("openai", `${label}: ответ за ${(res.ms / 1000).toFixed(1)} с (${res.model}${usage})`);
        const at = this.now();
        this.history.push({ role: "user", content: q, at }, { role: "assistant", content: res.text, at, by: provider });
        this.lastProvider = provider;
        this.deps.store.saveHistory(this.history);
        this.lastAnswer = res.text;
        const clean = sanitizeForG1(res.text);
        const asksBack = endsWithQuestion(clean);
        const lang = detectLang(clean);
        const replyHint = lang === "en" ? `
» reply by voice` : `
» ответьте голосом`;
        this.pages = paginate(clean.length ? clean + (asksBack ? replyHint : "") : "(пустой ответ)", { lang });
        this.page = 0;
        this.phase = "answering";
        const windowSec = Math.max(this.settings.followUpSec, asksBack ? REPLY_WINDOW_SEC : 0);
        this.followUpUntil = windowSec > 0 ? this.now() + windowSec * 1000 : 0;
        this.addLog("display", `Ответ: ${this.pages.length} экр.`);
        if (asksBack)
          this.addLog("info", `Встречный вопрос — жду ответ без активатора ${windowSec} с`);
        this.showPage(0);
      } catch (e) {
        if (seq !== this.requestSeq)
          return;
        const err = e;
        const status = typeof err?.status === "number" ? err.status : 0;
        const code = String(err?.code ?? "");
        const human = explainLLMError(err?.provider ?? provider, status, code, err?.message ?? "");
        this.addLog("error", `${human} [${status} ${code}] ${String(err?.message ?? "").slice(0, 160)}`);
        this.fail(human, seq);
      }
    }
    fail(message, seq) {
      if (seq !== this.requestSeq)
        return;
      this.lastError = message;
      this.phase = "idle";
      this.pages = [];
      this.flash(message, 8000);
      this.changed();
    }
    showPage(i) {
      if (!this.pages.length)
        return;
      this.page = Math.max(0, Math.min(this.pages.length - 1, i));
      this.phase = "answering";
      this.show(this.pages[this.page]);
      this.cancelTimer("pageTimer");
      this.cancelTimer("clearTimer_");
      const last = this.page >= this.pages.length - 1;
      if (this.settings.autoAdvanceSec > 0 && !last) {
        this.pageTimer = this.setTimer(() => {
          this.pageTimer = null;
          if (this.phase === "answering")
            this.showPage(this.page + 1);
        }, this.settings.autoAdvanceSec * 1000);
      }
      if (this.settings.clearAfterSec > 0 && last) {
        this.clearTimer_ = this.setTimer(() => {
          this.clearTimer_ = null;
          if (this.phase === "answering") {
            this.phase = "idle";
            this.autoHidden = true;
            this.clearDisplay();
            this.addLog("display", "Ответ убран по таймеру (последняя страница прочитана)");
            this.changed();
          }
        }, this.settings.clearAfterSec * 1000);
      }
      this.autoHidden = false;
      this.changed();
    }
    get translating() {
      return this.phase === "translating";
    }
    startTranslation(source) {
      if (!this.deps.startTranslation) {
        this.addLog("error", "Перевод недоступен в этой версии Mentra");
        this.flash("Перевод недоступен.", 3000);
        return;
      }
      if (this.phase === "lecture" || this.phase === "talk")
        this.leaveListeningMode();
      if (this.phase === "thinking")
        this.requestSeq++;
      for (const t of ["silenceTimer", "wakeTimer", "pageTimer", "clearTimer_"])
        this.cancelTimer(t);
      this.stopTranslationStream();
      this.committed = [];
      this.interim = "";
      this.trFinals = [];
      this.trInterim = null;
      this.translationScreen = "";
      this.phase = "translating";
      const target = this.settings.translateTo;
      try {
        this.translateUnsub = this.deps.startTranslation(target, (ev) => this.onTranslation(ev));
      } catch (e) {
        this.phase = "idle";
        this.addLog("error", `Не удалось включить перевод: ${String(e?.message ?? e)}`);
        this.flash("Не удалось включить перевод.", 3000);
        return;
      }
      const ru = target === "ru-RU";
      this.addLog("translate", `Перевод включён (${source === "ui" ? "с телефона" : "голосом"}) → ${ru ? "русский" : "английский"}`);
      this.show(ru ? `Перевод включён → русский
Выключить: «стоп перевод»` : `Translation on → English
To stop: «стоп перевод»`);
      this.armTranslateIdle();
      this.changed();
    }
    startLecture(source) {
      const provider = asProvider(this.settings.provider);
      if (!keyFor(this.settings, provider)) {
        const msg = explainLLMError(provider, 401, "no_key", "");
        this.addLog("error", `Режим лекции: ${msg}`);
        this.flash(msg, 6000);
        return;
      }
      if (this.phase === "translating" || this.phase === "talk")
        this.leaveListeningMode();
      if (this.phase === "thinking")
        this.requestSeq++;
      for (const t of ["silenceTimer", "wakeTimer", "pageTimer", "clearTimer_"])
        this.cancelTimer(t);
      this.committed = [];
      this.interim = "";
      this.followUpUntil = 0;
      this.phase = "lecture";
      if (this.settings.sttLanguage === "ru-RU") {
        this.addLog("error", "Распознавание настроено только на русский: английскую лекцию очки не поймут. Настройки → Язык распознавания → русский + английский.");
      }
      this.warnIfMicOff();
      this.lecture.start();
      this.addLog("lecture", `Тезисы и ответы пишет ${displayName(this.settings, provider)} (${source === "ui" ? "включено с телефона" : "включено голосом"})`);
    }
    stopLecture(source, announce = true) {
      if (this.phase !== "lecture")
        return;
      const { points, answers } = this.lecture.stop();
      this.phase = "idle";
      this.pages = [];
      if (announce) {
        const en = this.settings.translateTo === "en-US";
        this.flash(en ? `Lecture mode off.
Key points: ${points}, answers: ${answers}.
Notes are in the app.` : `Лекция выключена.
Тезисов: ${points}, ответов: ${answers}.
Конспект — в приложении.`, 4000);
      } else
        this.clearDisplay();
      if (source === "ui")
        this.addLog("cmd", "Режим лекции выключен с телефона");
      this.changed();
    }
    onTranscriptWhileLecture(t) {
      const wake = this.wake(t);
      const body = wake.matched ? wake.rest : t;
      const lc = parseLectureCommand(body);
      if (lc === "stop")
        return this.stopLecture("voice");
      if (lc === "start")
        return;
      const mine = wake.matched || detectLang(body) === "ru";
      if (mine && this.trySwitchMode(body))
        return;
      if (mine && this.tryPhrase(body))
        return;
      const cmd = parseCommand(body);
      if (mine && (cmd === "hide" || cmd === "cancel" || parseTranslateCommand(body) === "stop"))
        return this.stopLecture("voice");
      if (wake.matched && detectLang(body) === "ru" && isMeaningful(body) && !cmd) {
        this.addLog("ask", body);
        this.lecture.askUser(body);
        return;
      }
      this.lecture.onSpeech(t);
    }
    tryPhrase(body) {
      const waiting = this.phraseWait && this.now() < this.phraseWait.until ? this.phraseWait : null;
      this.phraseWait = null;
      const req = parsePhraseRequest(body);
      if (req) {
        if (!req.phrase) {
          this.phraseWait = { lang: req.lang, until: this.now() + PHRASE_WAIT_MS };
          this.addLog("cmd", `Перевод на ${PHRASE_LANG_NAME[req.lang]}: жду слово или фразу`);
          this.flash(`Как будет: ${PHRASE_LANG_NAME[req.lang]}
Скажите слово или фразу`, PHRASE_WAIT_MS);
          return true;
        }
        this.translatePhrase(req.phrase, req.lang);
        return true;
      }
      const cmd = parseCommand(body);
      if (waiting && normalize(body).length > 0 && cmd !== "cancel" && cmd !== "hide") {
        this.translatePhrase(body.replace(/[?？!.…]+$/u, "").trim(), waiting.lang);
        return true;
      }
      return false;
    }
    async translatePhrase(phrase, lang) {
      const provider = asProvider(this.settings.provider);
      if (!keyFor(this.settings, provider)) {
        this.flash(explainLLMError(provider, 401, "no_key", ""), 6000);
        return;
      }
      this.addLog("ask", `Перевод на ${PHRASE_LANG_NAME[lang]}: ${phrase}`);
      const run = async () => {
        const { system, user } = buildPhrasePrompt(phrase, lang);
        const a = cleanPhraseReply(await this.completeOnce(system, user));
        if (!a)
          return null;
        this.addLog("display", `${phrase} → ${a}`);
        return { q: phrase, a };
      };
      if (this.phase === "talk")
        return this.talk.aside(phrase, run, " → ");
      if (this.phase === "lecture")
        return this.lecture.aside(phrase, run);
      if (this.phase === "translating")
        this.stopTranslation("question", false);
      const seq = ++this.requestSeq;
      for (const t of ["silenceTimer", "wakeTimer", "pageTimer", "clearTimer_"])
        this.cancelTimer(t);
      this.committed = [];
      this.interim = "";
      this.phase = "thinking";
      this.lastQuestion = phrase;
      this.lastError = "";
      this.show(fitScreen(`${phrase} → …`));
      this.changed();
      try {
        const qa = await run();
        if (seq !== this.requestSeq)
          return;
        if (!qa)
          return this.fail(`Не получилось перевести «${phrase}».`, seq);
        const at = this.now();
        this.history.push({ role: "user", content: `Как будет (${PHRASE_LANG_NAME[lang]}): ${phrase}`, at }, { role: "assistant", content: qa.a, at, by: provider });
        this.lastProvider = provider;
        this.deps.store.saveHistory(this.history);
        this.lastAnswer = qa.a;
        this.pages = paginate(sanitizeForG1(`${phrase} → ${qa.a}`));
        this.page = 0;
        this.followUpUntil = 0;
        this.showPage(0);
      } catch (e) {
        if (seq !== this.requestSeq)
          return;
        const err = e;
        const human = explainLLMError(err?.provider ?? provider, Number(err?.status) || 0, String(err?.code ?? ""), String(err?.message ?? ""));
        this.addLog("error", `${human} [${err?.status ?? 0} ${err?.code ?? ""}]`);
        this.fail(human, seq);
      }
    }
    startTalk(source) {
      const provider = asProvider(this.settings.provider);
      if (!keyFor(this.settings, provider)) {
        const msg = explainLLMError(provider, 401, "no_key", "");
        this.addLog("error", `Режим беседы: ${msg}`);
        this.flash(msg, 6000);
        return;
      }
      if (this.phase === "translating" || this.phase === "lecture")
        this.leaveListeningMode();
      if (this.phase === "thinking")
        this.requestSeq++;
      for (const t of ["silenceTimer", "wakeTimer", "pageTimer", "clearTimer_"])
        this.cancelTimer(t);
      this.committed = [];
      this.interim = "";
      this.followUpUntil = 0;
      this.phase = "talk";
      this.warnIfMicOff();
      this.talk.start({ en: this.settings.translateTo === "en-US" });
      this.addLog("talk", `Подсказки пишет ${displayName(this.settings, provider)} (${source === "ui" ? "включено с телефона" : "включено голосом"})`);
    }
    stopTalk(source, announce = true) {
      if (this.phase !== "talk")
        return;
      const { hints } = this.talk.stop();
      this.phase = "idle";
      this.pages = [];
      if (announce) {
        const en = this.settings.translateTo === "en-US";
        this.flash(en ? `Conversation mode off.
Hints: ${hints}. The list is in the app.` : `Беседа выключена.
Подсказок: ${hints}. Список — в приложении.`, 4000);
      } else
        this.clearDisplay();
      if (source === "ui")
        this.addLog("cmd", "Режим беседы выключен с телефона");
      this.changed();
    }
    onTranscriptWhileTalk(t) {
      const wake = this.wake(t);
      const body = wake.matched ? wake.rest : t;
      const tc = parseTalkCommand(body);
      if (tc === "stop")
        return this.stopTalk("voice");
      if (tc === "start")
        return;
      const unambiguous = wake.matched || parseTranslateCommand(body) === "start" || normalize(body).split(" ").length >= 2;
      if (unambiguous && this.trySwitchMode(body))
        return;
      if (this.tryPhrase(body))
        return;
      const goal = wake.matched ? goalIn(t) : null;
      if (goal !== null)
        return this.setGoal(goal);
      const cmd = parseCommand(body);
      if (wake.matched && (cmd === "hide" || cmd === "cancel"))
        return this.stopTalk("voice");
      if (wake.matched && isMeaningful(body) && !cmd) {
        this.addLog("ask", body);
        this.talk.askUser(body);
        return;
      }
      this.talk.onSpeech(t);
    }
    setGoal(goal) {
      this.updateSettings({ talkGoal: goal });
      this.addLog("talk", goal ? `Цель беседы: ${goal}` : "Цель беседы убрана");
      this.flash(goal ? `Цель беседы:
${goal}` : "Цель беседы убрана.", 3000);
    }
    trySwitchMode(body) {
      const target = parseTranslateCommand(body) === "start" ? "translating" : parseLectureCommand(body) === "start" ? "lecture" : parseTalkCommand(body) === "start" ? "talk" : null;
      if (!target)
        return false;
      if (target === this.phase)
        return true;
      if (target === "translating")
        this.startTranslation("voice");
      else if (target === "lecture")
        this.startLecture("voice");
      else
        this.startTalk("voice");
      return true;
    }
    leaveListeningMode() {
      if (this.phase === "translating")
        this.stopTranslation("question", false);
      else if (this.phase === "lecture")
        this.stopLecture("switch", false);
      else if (this.phase === "talk")
        this.stopTalk("switch", false);
    }
    stopTranslation(source, announce = true) {
      if (this.phase !== "translating")
        return;
      this.stopTranslationStream();
      this.phase = "idle";
      this.translationScreen = "";
      this.addLog("translate", `Перевод выключен (${source === "ui" ? "с телефона" : source === "question" ? "задан вопрос" : "голосом"})`);
      if (announce)
        this.flash("Перевод выключен.", 1500);
      else
        this.clearDisplay();
      this.changed();
    }
    stopTranslationStream() {
      if (this.translateUnsub) {
        try {
          this.translateUnsub();
        } catch {}
        this.translateUnsub = null;
      }
      if (this.trRenderTimer != null) {
        this.clearTimerFn(this.trRenderTimer);
        this.trRenderTimer = null;
      }
      if (this.trIdleTimer != null) {
        this.clearTimerFn(this.trIdleTimer);
        this.trIdleTimer = null;
      }
    }
    onTranscriptWhileTranslating(t) {
      const wake = this.wake(t);
      const body = wake.matched ? wake.rest : t;
      const tcmd = parseTranslateCommand(body);
      if (tcmd === "stop") {
        this.stopTranslation("voice");
        return;
      }
      if (tcmd === "start")
        return;
      if (this.trySwitchMode(body))
        return;
      const cmd = parseCommand(body);
      if ((cmd === "hide" || cmd === "cancel") && (wake.matched || detectLang(body) === "ru")) {
        this.stopTranslation("voice");
        return;
      }
      if (wake.matched && isMeaningful(body) && !cmd) {
        this.stopTranslation("question", false);
        this.startCapture(false);
        this.captureProvider = aiForWakePhrase(wake.phrase);
        this.captureText(body, true);
      }
    }
    onTranslation(ev) {
      if (this.phase !== "translating")
        return;
      const text = sanitizeForG1(String(ev?.text ?? "")).replace(/\n+/g, " ").trim();
      if (!text)
        return;
      if (isPassthrough(ev, this.settings.translateTo))
        return;
      const id = ev.utteranceId ?? "_";
      if (ev.isFinal) {
        this.trFinals.push(text);
        if (this.trFinals.length > TRANSLATE_KEEP)
          this.trFinals.splice(0, this.trFinals.length - TRANSLATE_KEEP);
        if (!this.trInterim || this.trInterim.id === id)
          this.trInterim = null;
        this.addLog("translate", `${ev.sourceLanguage ? "[" + primaryLang(ev.sourceLanguage) + "] " : ""}${text}`);
      } else {
        this.trInterim = { id, text };
      }
      this.armTranslateIdle();
      this.scheduleTranslationRender(ev.isFinal);
    }
    scheduleTranslationRender(immediate) {
      const now = this.now();
      const due = immediate || now - this.trLastRender >= TRANSLATE_RENDER_MS;
      if (due) {
        if (this.trRenderTimer != null) {
          this.clearTimerFn(this.trRenderTimer);
          this.trRenderTimer = null;
        }
        this.renderTranslation();
      } else if (this.trRenderTimer == null) {
        this.trRenderTimer = this.setTimer(() => {
          this.trRenderTimer = null;
          this.renderTranslation();
        }, TRANSLATE_RENDER_MS - (now - this.trLastRender));
      }
    }
    renderTranslation() {
      if (this.phase !== "translating")
        return;
      const parts = [...this.trFinals];
      if (this.trInterim)
        parts.push(this.trInterim.text);
      const lines = wrapLines(parts.join(" "));
      const screen = lines.slice(-G1_LINES).join(`
`);
      this.trLastRender = this.now();
      if (screen && screen !== this.translationScreen) {
        this.translationScreen = screen;
        this.show(screen);
        this.changed();
      }
    }
    armTranslateIdle() {
      if (this.trIdleTimer != null)
        this.clearTimerFn(this.trIdleTimer);
      this.trIdleTimer = this.setTimer(() => {
        this.trIdleTimer = null;
        if (this.phase !== "translating")
          return;
        this.trFinals = [];
        this.trInterim = null;
        this.translationScreen = "";
        this.clearDisplay();
        this.changed();
      }, TRANSLATE_IDLE_MS);
    }
    onHeadPosition(position) {
      if (position !== "up" && position !== "down")
        return;
      const up = position === "up";
      if (up !== this.headUp) {
        this.headUp = up;
        this.headUpSince = this.now();
        this.addLog("head", up ? "Голова поднята" : "Голова опущена");
        if (!up && this.phase === "answering" && this.pages.length)
          this.show(this.pages[this.page]);
        if (!up && this.phase === "lecture" && this.lecture.screen)
          this.show(this.lecture.screen);
        if (!up && this.phase === "talk" && this.talk.screen)
          this.show(this.talk.screen);
        this.changed();
      }
      if (!up || !this.settings.headNod)
        return;
      if (this.phase !== "answering" || this.page >= this.pages.length - 1)
        return;
      const now = this.now();
      if (now - this.lastNodAt < NOD_DEBOUNCE_MS)
        return;
      this.lastNodAt = now;
      this.command("next", "head");
    }
    warnIfMicOff() {
      if (this.settings.listenMode === "off")
        this.addLog("error", "Микрофон выключен в настройках (Режим прослушивания) — очки ничего не услышат");
    }
    dashboardLikely() {
      return this.headUp && this.now() - this.headUpSince >= HEAD_UP_HIDES_MS;
    }
    warnIfDashboard() {
      if (!this.dashboardLikely())
        return;
      const now = this.now();
      if (now - this.lastDashboardWarnAt < DASHBOARD_WARN_EVERY_MS)
        return;
      this.lastDashboardWarnAt = now;
      this.addLog("error", DASHBOARD_WARNING);
    }
    command(cmd, source) {
      this.addLog("cmd", `${cmd} (${source})`);
      if (this.phase === "lecture" || this.phase === "talk") {
        const by = source === "ui" ? "ui" : "voice";
        if (cmd === "hide" || cmd === "cancel")
          this.phase === "lecture" ? this.stopLecture(by) : this.stopTalk(by);
        else if (cmd === "reset")
          this.resetConversation(false);
        return;
      }
      if (this.phase === "translating") {
        if (cmd === "hide" || cmd === "cancel")
          this.stopTranslation(source === "ui" ? "ui" : "voice");
        else if (cmd === "reset")
          this.resetConversation(false);
        return;
      }
      if (!this.pages.length && (cmd === "next" || cmd === "prev" || cmd === "first" || cmd === "repeat")) {
        if (this.phase === "idle")
          this.clearDisplay();
        return;
      }
      switch (cmd) {
        case "next":
          if (this.pages.length)
            this.showPage(this.page + 1);
          break;
        case "prev":
          if (this.pages.length)
            this.showPage(this.page - 1);
          break;
        case "first":
          if (this.pages.length)
            this.showPage(0);
          break;
        case "repeat":
          if (this.pages.length)
            this.showPage(this.page);
          break;
        case "hide":
        case "cancel":
          if (this.phase === "thinking") {
            this.requestSeq++;
            this.addLog("info", "Запрос отменён");
          }
          this.cancelTimer("silenceTimer");
          this.cancelTimer("wakeTimer");
          this.cancelTimer("pageTimer");
          this.cancelTimer("clearTimer_");
          this.committed = [];
          this.interim = "";
          this.phase = "idle";
          this.autoHidden = false;
          this.clearDisplay();
          this.changed();
          break;
        case "reset":
          this.phase = "idle";
          this.resetConversation(true);
          break;
      }
    }
    snapshot() {
      const hint = (k) => k ? `${k.slice(0, k.startsWith("sk-ant-") ? 7 : 3)}…${k.slice(-4)}` : "";
      const provider = asProvider(this.settings.provider);
      const key = keyFor(this.settings, provider);
      return {
        phase: this.phase,
        page: this.page,
        pages: this.pages.length,
        currentScreen: this.phase === "translating" ? this.translationScreen : this.phase === "lecture" ? this.lecture.screen : this.phase === "talk" ? this.talk.screen : this.pages[this.page] ?? "",
        translating: this.phase === "translating",
        lastTranscript: this.lastTranscript,
        lastQuestion: this.lastQuestion,
        lastAnswer: this.lastAnswer,
        lastError: this.lastError,
        dashboardLikely: this.dashboardLikely(),
        lecture: lectureSnapshot(this.lecture.active, this.lecture.record),
        talk: lectureSnapshot(this.talk.active, this.talk.record),
        glassesConnected: this.glassesConnected,
        settings: {
          ...this.settings,
          apiKey: "",
          anthropicKey: "",
          geminiKey: "",
          hasKey: Boolean(key),
          keyHint: hint(key),
          keys: {
            openai: { has: Boolean(this.settings.apiKey), hint: hint(this.settings.apiKey) },
            anthropic: { has: Boolean(this.settings.anthropicKey), hint: hint(this.settings.anthropicKey) },
            gemini: { has: Boolean(this.settings.geminiKey), hint: hint(this.settings.geminiKey) }
          },
          aiName: displayName(this.settings, provider)
        },
        historyCount: this.history.length,
        history: this.history.slice(-40),
        log: this.log.slice(-100)
      };
    }
  }
  function lectureSnapshot(active, r) {
    return {
      active,
      startedAt: r?.startedAt ?? 0,
      endedAt: r?.endedAt ?? 0,
      total: r?.notes.length ?? 0,
      notes: (r?.notes ?? []).slice(-120)
    };
  }
  function parseGoal(body) {
    const m = /^\s*(моя\s+|my\s+)?(?:цель|goal)(\s+(?:беседы|разговора|of the conversation))?(\s*[:—–-]\s*|\s+(?:это|is)\s+|\s+)(.+)$/i.exec(body);
    if (!m)
      return null;
    const [, mine, qualifier, sep, rest] = m;
    if (!/[:—–-]/.test(sep) && !mine && !qualifier)
      return null;
    const g = rest.trim().replace(/[.!]+$/, "");
    if (/^(нет|никакой|убрать|сбросить|none|no|clear)$/i.test(g))
      return "";
    return g.slice(0, 300);
  }
  function goalIn(raw) {
    const m = /(?:^|[\s,.:;!?«"])((?:моя\s+|my\s+)?(?:цель|goal)(?![\p{L}\p{N}]))/iu.exec(raw);
    if (!m)
      return null;
    const start = m.index + m[0].length - m[1].length;
    if (normalize(raw.slice(0, start)).split(" ").filter(Boolean).length > 3)
      return null;
    return parseGoal(raw.slice(start));
  }

  // src/background/index.ts
  var APP_VERSION = "1.10.0";
  function getKV() {
    try {
      const ls = globalThis.localStorage;
      if (!ls)
        return null;
      ls.getItem("g1gpt.probe");
      return ls;
    } catch {
      return null;
    }
  }
  registerMiniapp((session) => {
    const store = new Store(getKV());
    let uiTimer = null;
    const pushState = () => {
      if (uiTimer != null)
        return;
      uiTimer = setTimeout(() => {
        uiTimer = null;
        try {
          if (session.ui.isOpen())
            session.ui.send("state", snap());
        } catch {}
      }, 250);
    };
    const fullBox = () => {
      const d = session.capabilities?.display;
      return { x: 0, y: 0, w: d?.width ?? 576, h: d?.height ?? 200 };
    };
    const snap = () => ({ ...assistant.snapshot(), version: APP_VERSION });
    const assistant = new Assistant({
      store,
      fetch: (url, init) => globalThis.fetch(url, init),
      show: (text) => session.display.render([{ type: "text", id: "g1gpt", box: fullBox(), text, style: { breakMode: "word" } }]),
      clear: () => {
        session.display.render([])?.catch?.(() => {});
      },
      startTranslation: (target, handler) => session.translation.to(target, handler),
      onChange: pushState
    });
    assistant.addLog("info", `Запущено, версия ${APP_VERSION}`);
    const storageOk = store.selfTest();
    assistant.addLog(storageOk ? "info" : "error", storageOk ? "Хранилище на телефоне работает: ключи и настройки сохраняются" : "Хранилище недоступно: настройки сохранятся только до перезапуска Mentra");
    const provider = asProvider(assistant.settings.provider);
    if (!keyFor(assistant.settings, provider))
      assistant.addLog("info", `Ключ ${PROVIDERS[provider].label} не задан — откройте настройки`);
    let unsubscribeStt = null;
    let sttKey = "";
    const subscribeStt = (s) => {
      const key = `${s.listenMode}|${s.sttLanguage}|${s.wakeWords.join(",")}`;
      if (key === sttKey)
        return;
      sttKey = key;
      if (unsubscribeStt) {
        try {
          unsubscribeStt();
        } catch {}
        unsubscribeStt = null;
      }
      if (s.listenMode === "off") {
        assistant.addLog("info", "Микрофон выключен в настройках");
        return;
      }
      if (!session.transcription.hasPermission) {
        assistant.addLog("error", "Нет разрешения MICROPHONE в манифесте");
      }
      try {
        session.transcription.configure({
          languageHints: s.sttLanguage === "auto" ? ["ru", "en"] : ["ru"],
          vocabulary: s.wakeWords.slice(0, 10)
        })?.catch?.(() => {});
      } catch (e) {
        assistant.addLog("info", `configure STT пропущен: ${String(e?.message ?? e)}`);
      }
      const handler = (data) => assistant.onTranscript(data?.text ?? "", Boolean(data?.isFinal));
      try {
        unsubscribeStt = s.sttLanguage === "auto" ? session.transcription.on(handler) : session.transcription.forLanguage("ru-RU", handler);
        assistant.addLog("info", `Слушаю (${s.sttLanguage === "auto" ? "русский + английский" : "только русский"})`);
      } catch (e) {
        assistant.addLog("error", `Не удалось включить распознавание: ${String(e?.message ?? e)}`);
      }
    };
    subscribeStt(assistant.settings);
    try {
      session.input.onTouch((t) => assistant.onTouch(String(t?.kind ?? "")));
    } catch {}
    try {
      session.input.onButtonPress((p) => assistant.onTouch(p?.pressType === "long" ? "long_press" : "single_tap"));
    } catch {}
    try {
      session.imu.onHeadPosition((h) => assistant.onHeadPosition(String(h?.position ?? "")));
    } catch {}
    try {
      session.glasses.onConnection((c) => {
        assistant.glassesConnected = Boolean(c?.connected);
        assistant.addLog("info", c?.connected ? `Очки подключены${c.modelName ? ": " + c.modelName : ""}` : "Очки отключены");
      });
    } catch {}
    try {
      session.on?.("ready", () => {
        const d = session.capabilities?.display;
        if (d)
          assistant.addLog("info", `Дисплей ${d.width ?? "?"}×${d.height ?? "?"}${d.canPosition === false ? ", текстовый режим" : ""}`);
      });
    } catch {}
    session.ui.handle("getState", () => snap());
    session.ui.handle("saveSettings", (patch) => {
      const s = assistant.updateSettings(patch ?? {});
      subscribeStt(s);
      return snap();
    });
    session.ui.handle("ask", async (p) => {
      await assistant.ask(String(p?.text ?? ""), "ui");
      return snap();
    });
    session.ui.handle("command", (p) => {
      const cmd = String(p?.cmd ?? "");
      if (cmd === "provider")
        assistant.switchProvider(asProvider(p?.provider), "ui");
      else if (cmd === "translate")
        assistant.startTranslation("ui");
      else if (cmd === "translateStop")
        assistant.stopTranslation("ui");
      else if (cmd === "lecture")
        assistant.startLecture("ui");
      else if (cmd === "lectureStop")
        assistant.stopLecture("ui");
      else if (cmd === "talk")
        assistant.startTalk("ui");
      else if (cmd === "talkStop")
        assistant.stopTalk("ui");
      else if (["next", "prev", "first", "repeat", "hide", "cancel", "reset"].includes(cmd))
        assistant.command(cmd, p?.source === "key" ? "key" : "ui");
      return snap();
    });
    session.ui.handle("getLecture", () => assistant.lecture.record);
    session.ui.handle("getTalk", () => assistant.talk.record);
    session.ui.handle("simulateSpeech", (p) => {
      assistant.onTranscript(String(p?.text ?? ""), true);
      return snap();
    });
    session.ui.handle("testDisplay", async () => {
      const text = `Проверка дисплея G1
Ёжик, йогурт, щука
«кавычки» — тире, 0123
Latin text: Hello!
5-я строка`;
      let r = null;
      try {
        r = await session.display.render([{ type: "text", id: "g1gpt", box: fullBox(), text, style: { breakMode: "word" } }], {
          durationMs: 1e4
        });
      } catch (e) {
        assistant.addLog("error", `Тест дисплея: ${String(e?.message ?? e)}`);
      }
      assistant.addLog("display", `Тест дисплея: ${r?.status ?? "нет ответа"}${r?.degraded ? ", текстовый режим" : ""}${r?.reason ? ", " + r.reason : ""}`);
      return snap();
    });
    session.ui.onOpen(() => pushState());
  });
})();
