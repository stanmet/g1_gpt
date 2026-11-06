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
  var NAV_STOP = [
    "стоп навигация",
    "стоп навигатор",
    "стоп маршрут",
    "выключи навигатор",
    "выключи навигацию",
    "отмени маршрут",
    "отмена маршрута",
    "конец маршрута",
    "закончи маршрут",
    "закончи навигацию",
    "останови навигацию",
    "хватит навигации",
    "навигатор стоп",
    "навигация стоп",
    "маршрут стоп",
    "выключи маршрут",
    "stop navigation",
    "end navigation",
    "cancel route",
    "cancel navigation"
  ];
  var NAV_STATUS = [
    "сколько осталось",
    "сколько еще",
    "сколько еще идти",
    "сколько еще ехать",
    "сколько идти",
    "сколько ехать",
    "когда придем",
    "когда приедем",
    "далеко еще",
    "долго еще",
    "how far",
    "how long",
    "how much longer"
  ];
  var NAV_ASK = [
    "навигатор",
    "включи навигатор",
    "включи навигацию",
    "открой навигатор",
    "проложи маршрут",
    "построй маршрут",
    "проложи мне маршрут",
    "navigator",
    "start navigation"
  ];
  var NAV_STOP_SET = new Set(NAV_STOP.map((p) => normalize(p)));
  var NAV_ASK_SET = new Set(NAV_ASK.map((p) => normalize(p)));
  var NAV_STATUS_SET = new Set(NAV_STATUS.map((p) => normalize(p)));
  var NAV_GO = /^(?:(?:ну|а|и|слушай|пожалуйста|давай)\s+)*(?:(?:навигатор|навигация|маршрут)(?:\s+(?:до|к|ко|в|во|на))?|(?:проложи|построй|покажи)\s+(?:мне\s+)?(?:маршрут|дорогу|путь)\s+(?:до|к|ко|в|во|на)|(?:проведи|веди|отведи|доведи|отвези|довези|подвези)\s+(?:меня\s+)?(?:до|к|ко|в|во|на)|как\s+(?:мне\s+)?(?:дойти|пройти|доехать|добраться|проехать|попасть)\s+(?:до|к|ко|в|во|на)|(?:navigate|directions|take me|get me|route)\s+to|how\s+(?:do|can)\s+i\s+get\s+to)\s+(.+)$/iu;
  var MODE_WORDS = [
    [/\s*,?\s*(?:пешком|на ногах|by foot|on foot|walking)\s*$/iu, "walking"],
    [/\s*,?\s*(?:на машине|на авто|на автомобиле|на такси|by car|driving)\s*$/iu, "driving"],
    [/\s*,?\s*(?:на велосипеде|на велике|by bike|cycling)\s*$/iu, "cycling"]
  ];
  function parseNavCommand(text) {
    const raw = String(text ?? "").replace(/\s+/g, " ").trim().replace(/[?？!.…]+$/u, "").trim();
    if (!raw)
      return null;
    const n = normalize(raw);
    if (NAV_STOP_SET.has(n))
      return { kind: "stop" };
    if (NAV_STATUS_SET.has(n))
      return { kind: "status" };
    for (const [re, md] of MODE_WORDS) {
      const bare = re.test(raw) ? normalize(raw.replace(re, "")) : "";
      if (bare && NAV_ASK_SET.has(bare))
        return { kind: "ask", mode: md };
    }
    if (NAV_ASK_SET.has(n))
      return { kind: "ask", mode: null };
    const m = NAV_GO.exec(raw);
    if (!m)
      return null;
    let query = m[1].trim();
    let mode = null;
    for (const [re, md] of MODE_WORDS) {
      if (re.test(query)) {
        mode = md;
        query = query.replace(re, "").trim();
        break;
      }
    }
    if (!mode) {
      const verb = normalize(raw.slice(0, raw.length - m[1].length));
      if (/(доехать|проехать|отвези|довези|подвези)/.test(verb))
        mode = "driving";
      else if (/(дойти|пройти)/.test(verb))
        mode = "walking";
    }
    query = query.replace(/^[«"“„']+|[»"”']+$/gu, "").replace(/[,.]+$/u, "").trim();
    if (!query || query.split(/\s+/).length > 10)
      return null;
    return { kind: "go", query, mode };
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

  // src/shared/inflate.ts
  var LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  var LEN_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  var DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  var DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  var CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
  function buildHuff(lengths, n) {
    const counts = new Uint16Array(16);
    for (let i = 0;i < n; i++)
      counts[lengths[i]]++;
    counts[0] = 0;
    const offs = new Uint16Array(16);
    for (let i = 1;i < 16; i++)
      offs[i] = offs[i - 1] + counts[i - 1];
    const symbols = new Uint16Array(n);
    for (let i = 0;i < n; i++)
      if (lengths[i])
        symbols[offs[lengths[i]]++] = i;
    return { counts, symbols };
  }
  var FIXED_LIT = null;
  var FIXED_DIST = null;
  function fixed() {
    if (!FIXED_LIT || !FIXED_DIST) {
      const l = new Uint8Array(288);
      for (let i = 0;i < 288; i++)
        l[i] = i < 144 ? 8 : i < 256 ? 9 : i < 280 ? 7 : 8;
      FIXED_LIT = buildHuff(l, 288);
      FIXED_DIST = buildHuff(new Uint8Array(30).fill(5), 30);
    }
    return [FIXED_LIT, FIXED_DIST];
  }

  class Bits {
    src;
    pos = 0;
    bitBuf = 0;
    bitCnt = 0;
    constructor(src) {
      this.src = src;
    }
    bit() {
      if (this.bitCnt === 0) {
        if (this.pos >= this.src.length)
          throw new Error("inflate: unexpected end of data");
        this.bitBuf = this.src[this.pos++];
        this.bitCnt = 8;
      }
      const b = this.bitBuf & 1;
      this.bitBuf >>= 1;
      this.bitCnt--;
      return b;
    }
    bits(n) {
      let v = 0;
      for (let i = 0;i < n; i++)
        v |= this.bit() << i;
      return v;
    }
    decode(h) {
      let code = 0;
      let first = 0;
      let index = 0;
      for (let len = 1;len < 16; len++) {
        code |= this.bit();
        const count = h.counts[len];
        if (code - first < count)
          return h.symbols[index + (code - first)];
        index += count;
        first = first + count << 1;
        code <<= 1;
      }
      throw new Error("inflate: bad Huffman code");
    }
    alignByte() {
      this.bitCnt = 0;
    }
  }

  class Out {
    buf;
    len = 0;
    constructor(size) {
      this.buf = new Uint8Array(Math.max(1024, size));
    }
    ensure(n) {
      if (this.len + n <= this.buf.length)
        return;
      let cap = this.buf.length * 2;
      while (cap < this.len + n)
        cap *= 2;
      const b = new Uint8Array(cap);
      b.set(this.buf.subarray(0, this.len));
      this.buf = b;
    }
    push(v) {
      this.ensure(1);
      this.buf[this.len++] = v;
    }
    copy(dist, n) {
      if (dist > this.len)
        throw new Error("inflate: bad distance");
      this.ensure(n);
      for (let i = 0;i < n; i++)
        this.buf[this.len] = this.buf[this.len++ - dist];
    }
  }
  function inflateRaw(src, sizeHint = src.length * 3) {
    const r = new Bits(src);
    const out = new Out(sizeHint);
    for (;; ) {
      const last = r.bit();
      const type = r.bits(2);
      if (type === 0) {
        r.alignByte();
        if (r.pos + 4 > src.length)
          throw new Error("inflate: truncated stored block");
        const len = src[r.pos] | src[r.pos + 1] << 8;
        r.pos += 4;
        if (r.pos + len > src.length)
          throw new Error("inflate: truncated stored block");
        out.ensure(len);
        out.buf.set(src.subarray(r.pos, r.pos + len), out.len);
        out.len += len;
        r.pos += len;
      } else if (type === 1 || type === 2) {
        let lit;
        let dist;
        if (type === 1)
          [lit, dist] = fixed();
        else {
          const hlit = r.bits(5) + 257;
          const hdist = r.bits(5) + 1;
          const hclen = r.bits(4) + 4;
          const cl = new Uint8Array(19);
          for (let i = 0;i < hclen; i++)
            cl[CL_ORDER[i]] = r.bits(3);
          const clh = buildHuff(cl, 19);
          const lens = new Uint8Array(hlit + hdist);
          for (let i = 0;i < hlit + hdist; ) {
            const sym = r.decode(clh);
            if (sym < 16)
              lens[i++] = sym;
            else {
              let rep = 0;
              let val = 0;
              if (sym === 16) {
                if (i === 0)
                  throw new Error("inflate: repeat with no previous length");
                val = lens[i - 1];
                rep = 3 + r.bits(2);
              } else if (sym === 17)
                rep = 3 + r.bits(3);
              else
                rep = 11 + r.bits(7);
              while (rep-- > 0)
                lens[i++] = val;
            }
          }
          lit = buildHuff(lens.subarray(0, hlit), hlit);
          dist = buildHuff(lens.subarray(hlit), hdist);
        }
        for (;; ) {
          const sym = r.decode(lit);
          if (sym < 256)
            out.push(sym);
          else if (sym === 256)
            break;
          else {
            const li = sym - 257;
            if (li >= 29)
              throw new Error("inflate: bad length symbol");
            const len = LEN_BASE[li] + r.bits(LEN_EXTRA[li]);
            const di = r.decode(dist);
            if (di >= 30)
              throw new Error("inflate: bad distance symbol");
            out.copy(DIST_BASE[di] + r.bits(DIST_EXTRA[di]), len);
          }
        }
      } else
        throw new Error("inflate: bad block type");
      if (last)
        break;
    }
    return out.buf.subarray(0, out.len);
  }
  function maybeInflate(src) {
    if (src.length > 18 && src[0] === 31 && src[1] === 139 && src[2] === 8) {
      const flg = src[3];
      let p = 10;
      if (flg & 4)
        p += 2 + (src[p] | src[p + 1] << 8);
      if (flg & 8)
        while (p < src.length && src[p++] !== 0)
          ;
      if (flg & 16)
        while (p < src.length && src[p++] !== 0)
          ;
      if (flg & 2)
        p += 2;
      const isize = src[src.length - 4] | src[src.length - 3] << 8 | src[src.length - 2] << 16 | src[src.length - 1] << 24;
      return inflateRaw(src.subarray(p, src.length - 8), isize >>> 0);
    }
    if (src.length > 2 && (src[0] & 15) === 8 && (src[0] << 8 | src[1]) % 31 === 0)
      return inflateRaw(src.subarray(2, src.length - 4));
    return src;
  }

  // src/shared/mvt.ts
  class Pbf {
    buf;
    end;
    pos;
    constructor(buf, start = 0, end = buf.length) {
      this.buf = buf;
      this.end = end;
      this.pos = start;
    }
    varint() {
      let result = 0;
      let shift = 0;
      for (;; ) {
        if (this.pos >= this.end)
          throw new Error("mvt: truncated varint");
        const b = this.buf[this.pos++];
        if (shift < 28)
          result |= (b & 127) << shift;
        else
          result += (b & 127) * 2 ** shift;
        if (b < 128)
          break;
        shift += 7;
      }
      return result;
    }
    svarint() {
      const n = this.varint();
      return n % 2 === 1 ? (n + 1) / -2 : n / 2;
    }
    bytesEnd() {
      const len = this.varint();
      return this.pos + len;
    }
    skip(wire) {
      if (wire === 0)
        this.varint();
      else if (wire === 1)
        this.pos += 8;
      else if (wire === 2)
        this.pos = this.bytesEnd();
      else if (wire === 5)
        this.pos += 4;
      else
        throw new Error(`mvt: unsupported wire type ${wire}`);
    }
    string() {
      const end = this.bytesEnd();
      const s = utf8(this.buf, this.pos, end);
      this.pos = end;
      return s;
    }
    float() {
      const v = new DataView(this.buf.buffer, this.buf.byteOffset + this.pos, 4).getFloat32(0, true);
      this.pos += 4;
      return v;
    }
    double() {
      const v = new DataView(this.buf.buffer, this.buf.byteOffset + this.pos, 8).getFloat64(0, true);
      this.pos += 8;
      return v;
    }
  }
  function utf8(b, start, end) {
    let s = "";
    let i = start;
    while (i < end) {
      const c = b[i++];
      if (c < 128)
        s += String.fromCharCode(c);
      else if (c < 224)
        s += String.fromCharCode((c & 31) << 6 | b[i++] & 63);
      else if (c < 240)
        s += String.fromCharCode((c & 15) << 12 | (b[i++] & 63) << 6 | b[i++] & 63);
      else {
        const cp = ((c & 7) << 18 | (b[i++] & 63) << 12 | (b[i++] & 63) << 6 | b[i++] & 63) - 65536;
        s += String.fromCharCode(55296 + (cp >> 10), 56320 + (cp & 1023));
      }
    }
    return s;
  }
  function readValue(p, end) {
    let v = "";
    while (p.pos < end) {
      const tag = p.varint();
      const field = tag >> 3;
      const wire = tag & 7;
      if (field === 1)
        v = p.string();
      else if (field === 2)
        v = p.float();
      else if (field === 3)
        v = p.double();
      else if (field === 4 || field === 5)
        v = p.varint();
      else if (field === 6)
        v = p.svarint();
      else if (field === 7)
        v = p.varint() !== 0;
      else
        p.skip(wire);
    }
    return v;
  }
  function decodeGeom(p, end, type) {
    const out = [];
    let x = 0;
    let y = 0;
    let cur = null;
    while (p.pos < end) {
      const cmdInt = p.varint();
      const cmd = cmdInt & 7;
      let count = cmdInt >> 3;
      if (cmd === 1) {
        while (count-- > 0) {
          x += p.svarint();
          y += p.svarint();
          if (type === 1) {
            if (!cur)
              out.push(cur = []);
            cur.push(x, y);
          } else {
            cur = [x, y];
            out.push(cur);
          }
        }
      } else if (cmd === 2) {
        while (count-- > 0) {
          x += p.svarint();
          y += p.svarint();
          cur?.push(x, y);
        }
      } else if (cmd === 7) {
        if (cur && cur.length >= 2)
          cur.push(cur[0], cur[1]);
      } else
        throw new Error(`mvt: bad command ${cmd}`);
    }
    return out;
  }
  function decodeTile(bytes, opts = {}) {
    const buf = maybeInflate(bytes);
    const p = new Pbf(buf);
    const out = {};
    while (p.pos < p.end) {
      const tag = p.varint();
      if (tag >> 3 !== 3 || (tag & 7) !== 2) {
        p.skip(tag & 7);
        continue;
      }
      const end = p.bytesEnd();
      const layer = decodeLayer(new Pbf(buf, p.pos, end), opts);
      if (layer)
        out[layer.name] = layer;
      p.pos = end;
    }
    return out;
  }
  function decodeLayer(p, opts) {
    let name = "";
    let extent = 4096;
    const keys = [];
    const values = [];
    const featureSpans = [];
    while (p.pos < p.end) {
      const tag = p.varint();
      const field = tag >> 3;
      const wire = tag & 7;
      if (field === 1) {
        name = p.string();
        if (opts.layers && !opts.layers.has(name))
          return null;
      } else if (field === 2) {
        const end = p.bytesEnd();
        featureSpans.push([p.pos, end]);
        p.pos = end;
      } else if (field === 3)
        keys.push(p.string());
      else if (field === 4) {
        const end = p.bytesEnd();
        values.push(readValue(p, end));
        p.pos = end;
      } else if (field === 5)
        extent = p.varint();
      else
        p.skip(wire);
    }
    if (opts.layers && !opts.layers.has(name))
      return null;
    const features = [];
    for (const [start, end] of featureSpans) {
      const f = new Pbf(p.buf, start, end);
      let type = 1;
      let tagsAt = null;
      let geomAt = null;
      while (f.pos < f.end) {
        const tag = f.varint();
        const field = tag >> 3;
        if (field === 2 || field === 4) {
          const e = f.bytesEnd();
          if (field === 2)
            tagsAt = [f.pos, e];
          else
            geomAt = [f.pos, e];
          f.pos = e;
        } else if (field === 3)
          type = f.varint();
        else
          f.skip(tag & 7);
      }
      if (!geomAt)
        continue;
      const props = {};
      if (tagsAt) {
        const t = new Pbf(p.buf, tagsAt[0], tagsAt[1]);
        while (t.pos < t.end) {
          const k = keys[t.varint()];
          const v = values[t.varint()];
          if (k !== undefined && (!opts.props || opts.props.has(k)))
            props[k] = v;
        }
      }
      const g = new Pbf(p.buf, geomAt[0], geomAt[1]);
      features.push({ type, props, geom: decodeGeom(g, geomAt[1], type) });
    }
    return { name, extent, features };
  }
  var TILE_ZOOM = 14;
  var EARTH_CIRCUMFERENCE = 40075016.686;
  function toWorld(lat, lng) {
    const s = Math.sin(Math.max(-85.05, Math.min(85.05, lat)) * Math.PI / 180);
    return { x: (lng + 180) / 360, y: 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI) };
  }
  function metersPerWorld(lat) {
    return EARTH_CIRCUMFERENCE * Math.cos(lat * Math.PI / 180);
  }
  function tileOf(lat, lng, z = TILE_ZOOM) {
    const w = toWorld(lat, lng);
    const n = 2 ** z;
    return { x: Math.min(n - 1, Math.floor(w.x * n)), y: Math.min(n - 1, Math.floor(w.y * n)) };
  }
  function tilesAround(lat, lng, radiusM, z = TILE_ZOOM) {
    const w = toWorld(lat, lng);
    const r = radiusM / metersPerWorld(lat);
    const n = 2 ** z;
    const x0 = Math.max(0, Math.floor((w.x - r) * n));
    const x1 = Math.min(n - 1, Math.floor((w.x + r) * n));
    const y0 = Math.max(0, Math.floor((w.y - r) * n));
    const y1 = Math.min(n - 1, Math.floor((w.y + r) * n));
    const out = [];
    for (let y = y0;y <= y1; y++)
      for (let x = x0;x <= x1; x++)
        out.push({ x, y });
    return out;
  }

  // src/background/glassfont.data.ts
  var GLASS_FONTS = { text: { ascent: 19, descent: 5, lineHeight: 24, glyphs: { " ": [5, 0, 0, 0, 0, 0], "!": [6, 2, 5, 3, 14, 0], '"': [10, 2, 5, 6, 6, 14], "#": [12, 0, 5, 12, 14, 20], $: [12, 1, 3, 10, 18, 48], "%": [19, 2, 5, 15, 14, 84], "&": [13, 1, 5, 11, 14, 112], "'": [6, 2, 5, 2, 6, 140], "(": [7, 2, 4, 4, 17, 146], ")": [7, 1, 4, 4, 17, 163], "*": [10, 1, 5, 8, 8, 180], "+": [13, 2, 9, 9, 10, 188], ",": [6, 1, 17, 3, 6, 208], "-": [9, 1, 12, 7, 2, 214], ".": [6, 2, 16, 3, 3, 216], "/": [7, 0, 4, 7, 17, 219], "0": [13, 1, 5, 11, 14, 236], "1": [8, 1, 5, 6, 14, 264], "2": [12, 1, 5, 10, 14, 278], "3": [12, 1, 5, 10, 14, 306], "4": [13, 1, 5, 11, 14, 334], "5": [12, 1, 5, 10, 14, 362], "6": [12, 1, 5, 10, 14, 390], "7": [11, 1, 5, 9, 14, 418], "8": [12, 1, 5, 10, 14, 446], "9": [12, 1, 4, 10, 14, 474], ":": [6, 2, 8, 3, 10, 502], ";": [6, 1, 9, 4, 13, 512], "<": [13, 2, 8, 9, 10, 525], "=": [13, 2, 10, 9, 7, 545], ">": [13, 2, 8, 9, 10, 559], "?": [10, 1, 5, 8, 14, 579], "@": [19, 1, 5, 17, 18, 593], A: [14, 1, 5, 12, 14, 647], B: [13, 1, 5, 11, 14, 675], C: [14, 1, 5, 12, 14, 703], D: [14, 1, 5, 12, 14, 731], E: [12, 1, 5, 9, 14, 759], F: [11, 1, 5, 9, 14, 787], G: [14, 1, 5, 12, 14, 815], H: [14, 1, 5, 12, 14, 843], I: [5, 1, 5, 3, 14, 871], J: [11, 1, 5, 9, 14, 885], K: [13, 1, 5, 12, 14, 913], L: [11, 1, 5, 9, 14, 941], M: [18, 1, 5, 15, 14, 969], N: [14, 1, 5, 12, 14, 997], O: [15, 1, 5, 13, 14, 1025], P: [12, 1, 5, 10, 14, 1053], Q: [15, 1, 5, 13, 15, 1081], R: [12, 1, 5, 11, 14, 1111], S: [12, 1, 5, 10, 14, 1139], T: [13, 1, 5, 11, 14, 1167], U: [14, 1, 5, 12, 14, 1195], V: [14, 1, 5, 12, 14, 1223], W: [19, 1, 5, 18, 14, 1251], X: [14, 1, 5, 12, 14, 1293], Y: [14, 1, 5, 12, 14, 1321], Z: [12, 1, 5, 10, 14, 1349], "[": [7, 2, 4, 4, 18, 1377], "\\": [7, 0, 4, 7, 17, 1395], "]": [7, 1, 4, 4, 18, 1412], "^": [9, 1, 5, 7, 6, 1430], _: [9, 0, 19, 9, 2, 1436], "`": [7, 2, 4, 3, 3, 1440], a: [11, 1, 8, 9, 11, 1443], b: [12, 1, 5, 10, 14, 1465], c: [11, 1, 8, 9, 11, 1493], d: [12, 1, 5, 10, 14, 1515], e: [11, 1, 8, 9, 11, 1543], f: [7, 0, 4, 7, 15, 1565], g: [12, 1, 8, 10, 15, 1580], h: [12, 1, 5, 9, 14, 1610], i: [5, 1, 4, 3, 15, 1638], j: [5, -1, 4, 4, 19, 1653], k: [11, 1, 5, 9, 14, 1672], l: [5, 1, 5, 3, 14, 1700], m: [17, 1, 8, 15, 11, 1714], n: [12, 1, 8, 9, 11, 1736], o: [12, 1, 8, 10, 11, 1758], p: [12, 1, 8, 10, 15, 1780], q: [12, 1, 8, 10, 15, 1810], r: [8, 1, 8, 6, 11, 1840], s: [10, 1, 8, 9, 11, 1851], t: [7, 0, 5, 6, 13, 1873], u: [12, 1, 8, 9, 11, 1886], v: [11, 1, 8, 10, 11, 1908], w: [16, 1, 8, 14, 11, 1930], x: [11, 1, 8, 9, 11, 1952], y: [11, 1, 8, 10, 15, 1974], z: [11, 1, 8, 9, 11, 2004], "{": [9, 1, 4, 7, 18, 2026], "|": [7, 2, 1, 3, 23, 2044], "}": [9, 1, 4, 6, 18, 2067], "~": [13, 1, 11, 10, 5, 2085], "«": [12, 1, 9, 10, 9, 2095], "°": [9, 1, 5, 7, 7, 2113], "·": [6, 2, 11, 3, 3, 2120], "»": [12, 1, 9, 10, 9, 2123], "À": [14, 1, 1, 12, 18, 2141], "Á": [14, 1, 1, 12, 18, 2177], "Â": [14, 1, 1, 12, 18, 2213], "Ã": [14, 1, 1, 12, 18, 2249], "Ä": [14, 1, 1, 12, 18, 2285], "Å": [14, 1, 0, 12, 19, 2321], "Æ": [19, 1, 5, 17, 14, 2359], "Ç": [14, 1, 5, 12, 18, 2401], "È": [12, 1, 1, 9, 18, 2437], "É": [12, 1, 1, 9, 18, 2473], "Ê": [12, 1, 1, 9, 18, 2509], "Ë": [12, 1, 1, 9, 18, 2545], "Ì": [5, -1, 1, 4, 18, 2581], "Í": [5, 1, 1, 4, 18, 2599], "Î": [5, -1, 1, 7, 18, 2617], "Ï": [5, -1, 1, 7, 18, 2635], "Ð": [14, 0, 5, 13, 14, 2653], "Ñ": [14, 1, 1, 12, 18, 2681], "Ò": [15, 1, 1, 13, 18, 2717], "Ó": [15, 1, 1, 13, 18, 2753], "Ô": [15, 1, 1, 13, 18, 2789], "Õ": [15, 1, 1, 13, 18, 2825], "Ö": [15, 1, 1, 13, 18, 2861], "×": [13, 2, 9, 9, 9, 2897], "Ø": [15, 1, 4, 13, 14, 2915], "Ù": [14, 1, 1, 12, 18, 2943], "Ú": [14, 1, 1, 12, 18, 2979], "Û": [14, 1, 1, 12, 18, 3015], "Ü": [14, 1, 1, 12, 18, 3051], "Ý": [14, 1, 1, 12, 18, 3087], "Þ": [12, 1, 5, 10, 14, 3123], "ß": [12, 1, 5, 10, 14, 3151], "à": [11, 1, 4, 9, 15, 3179], "á": [11, 1, 4, 9, 15, 3209], "â": [11, 1, 4, 9, 15, 3239], "ã": [11, 1, 4, 9, 15, 3269], "ä": [11, 1, 4, 9, 15, 3299], "å": [11, 1, 2, 9, 16, 3329], "æ": [17, 1, 8, 16, 11, 3361], "ç": [11, 1, 8, 9, 15, 3383], "è": [11, 1, 4, 9, 15, 3413], "é": [11, 1, 4, 9, 15, 3443], "ê": [11, 1, 4, 9, 15, 3473], "ë": [11, 1, 4, 9, 15, 3503], "ì": [5, -1, 4, 4, 15, 3533], "í": [5, 1, 4, 4, 15, 3548], "î": [5, -2, 4, 7, 15, 3563], "ï": [5, -1, 4, 7, 15, 3578], "ð": [11, 1, 4, 9, 15, 3593], "ñ": [12, 1, 4, 9, 15, 3623], "ò": [12, 1, 4, 10, 15, 3653], "ó": [12, 1, 4, 10, 15, 3683], "ô": [12, 1, 4, 10, 15, 3713], "õ": [12, 1, 4, 10, 15, 3743], "ö": [12, 1, 4, 10, 15, 3773], "÷": [13, 2, 8, 9, 11, 3803], "ø": [12, 1, 7, 10, 11, 3825], "ù": [12, 1, 4, 9, 15, 3847], "ú": [12, 1, 4, 9, 15, 3877], "û": [12, 1, 4, 9, 15, 3907], "ü": [12, 1, 4, 9, 15, 3937], "ý": [11, 1, 4, 10, 19, 3967], "þ": [12, 1, 5, 10, 18, 4005], "ÿ": [11, 1, 4, 10, 19, 4041], "Ё": [12, 1, 1, 9, 18, 4079], "А": [14, 1, 5, 12, 14, 4115], "Б": [12, 1, 5, 10, 14, 4143], "В": [13, 1, 5, 11, 14, 4171], "Г": [11, 1, 5, 9, 14, 4199], "Д": [16, 1, 5, 14, 17, 4227], "Е": [12, 1, 5, 9, 14, 4261], "Ж": [20, 1, 5, 18, 14, 4289], "З": [12, 1, 5, 10, 14, 4331], "И": [14, 1, 5, 12, 14, 4359], "Й": [14, 1, 0, 12, 18, 4387], "К": [13, 1, 5, 11, 14, 4423], "Л": [14, 1, 5, 12, 14, 4451], "М": [18, 1, 5, 15, 14, 4479], "Н": [14, 1, 5, 12, 14, 4507], "О": [15, 1, 5, 13, 14, 4535], "П": [14, 1, 5, 12, 14, 4563], "Р": [12, 1, 5, 10, 14, 4591], "С": [14, 1, 5, 12, 14, 4619], "Т": [13, 1, 5, 11, 14, 4647], "У": [13, 1, 5, 11, 14, 4675], "Ф": [16, 1, 4, 14, 15, 4703], "Х": [14, 1, 5, 12, 14, 4733], "Ц": [14, 1, 5, 13, 17, 4761], "Ч": [13, 1, 5, 11, 14, 4795], "Ш": [19, 1, 5, 16, 14, 4823], "Щ": [19, 1, 5, 18, 17, 4851], "Ъ": [16, 1, 5, 14, 14, 4902], "Ы": [17, 1, 5, 15, 14, 4930], "Ь": [12, 1, 5, 11, 14, 4958], "Э": [14, 1, 5, 12, 14, 4986], "Ю": [20, 1, 5, 18, 14, 5014], "Я": [12, 1, 5, 10, 14, 5056], "а": [11, 1, 8, 9, 11, 5084], "б": [11, 1, 4, 10, 14, 5106], "в": [11, 1, 8, 9, 11, 5134], "г": [8, 1, 8, 7, 11, 5156], "д": [12, 0, 8, 12, 14, 5167], "е": [11, 1, 8, 9, 11, 5195], "ж": [16, 1, 8, 14, 11, 5217], "з": [10, 1, 8, 8, 11, 5239], "и": [12, 1, 8, 9, 11, 5250], "й": [12, 1, 3, 9, 15, 5272], "к": [11, 1, 8, 9, 11, 5302], "л": [11, 0, 8, 10, 11, 5324], "м": [15, 1, 8, 13, 11, 5346], "н": [12, 1, 8, 9, 11, 5368], "о": [12, 1, 8, 10, 11, 5390], "п": [12, 1, 8, 9, 11, 5412], "р": [12, 1, 8, 10, 15, 5434], "с": [11, 1, 8, 9, 11, 5464], "т": [9, 0, 8, 9, 11, 5486], "у": [11, 1, 8, 10, 15, 5508], "ф": [14, 1, 5, 13, 17, 5538], "х": [11, 1, 8, 9, 11, 5572], "ц": [12, 1, 8, 11, 14, 5594], "ч": [11, 1, 8, 9, 11, 5622], "ш": [16, 1, 8, 14, 11, 5644], "щ": [17, 1, 8, 15, 14, 5666], "ъ": [13, 0, 8, 12, 11, 5694], "ы": [15, 1, 8, 13, 11, 5716], "ь": [11, 1, 8, 9, 11, 5738], "э": [11, 1, 8, 9, 11, 5760], "ю": [16, 1, 8, 14, 11, 5782], "я": [11, 1, 8, 9, 11, 5804], "ё": [11, 1, 4, 9, 15, 5826], "–": [10, 0, 12, 10, 2, 5856], "—": [19, 0, 12, 19, 2, 5860], "‘": [6, 2, 5, 3, 6, 5866], "’": [6, 2, 5, 3, 6, 5872], "“": [10, 2, 5, 7, 6, 5878], "”": [10, 2, 5, 7, 6, 5884], "…": [18, 2, 16, 15, 3, 5890], "№": [21, 1, 5, 19, 14, 5896] }, bits: "wMDAwMDAwMDAAADA4MDMzMzMzMwMYAxACMAYwH/wf/AYwBmA/+D/4DGAMYAxgDEABAAEAB8Af4B1wOTA5AB0AH8AH4AFwATAxMDlwH/APwAEAAQAeBj4MMwgzGDMwPiAIYADCAI+BiYMZghmGD4wHB4APwBjAGMAdwA+ADwAfGDu4MfAw8DjwH/APuDAwMDAwMAwcGBg4ODAwMDAwMDg4GBwMMDgYGBwMDAwMDAwMHBwYODAGFj/PD5/GBgYABgAGAAYAP+A/4AYABgAGAAYAGBgYMDAwP7+wODABg4MDAwcGBgYMDAwMGBgYOAfAD+AccDhwODA4MDA4MDg4MDgwOHAccA/gB8APHz8nBwcHBwcHBwcHBw+AH+AY4DhgAGAAYADgAcADgAcADgAcAD/wP/AHgB/gGGA4cABwAOADwAPgAHAAMDhwOHAf4A/AAOAB4APgA2AGYA5gDGAYYDhgP/g/+ABgAGAAYB/gH+AYABgAGAAbwB/gGHAAcAAwOHAYYB/gB4AHwA/gHHAYcDgAM8A34DxwODA4MDgwHHAP4AfAP+A/4ADgAMABwAHAA4ADgAcABwAOAA4AHAAcAAeAH+AYYDhwGHAcYA/AH+A4cDgwODA4cB/gD8AHgB/gOOA4cDAwOHA4cB+wDzAAcDhwGOAfwAeAMDgwAAAAADA4MBgcGAAAAAAAGBgYMDAAYAHgD4A+ADgAPAAfAAfAAOAAID/gP+AAAAAAAAA/4D/gMAA8AB8AA+AA4AHgB8A+ADgAIAAPH/nwwMHDhwYGAAYOBgD4AAf/AA8DgBwBwBhwwDn0YDGMYDMMYDMEYDMEYDMMYDGOwDn/wBhzABwAAA8CAAf+AAD8AAPAA8AHwAbgBuAOYA5wDHAcMB/4H/g4GDgcMBw/wD/gOHA4MDgwOHA/wD/wODA4ODg4OHA/8D/gA+AP8B44GBw4DDgAMAAwADgAOAwYHB44D/AD4D/AP/A4eDg4OBg4HDgcOBw4HDgYODg4eD/wP8A/4D/gOAA4ADgAOAA/4D/gOAA4ADgAOAA/4D/gP+A/4DgAOAA4ADgAP+A/4DgAOAA4ADgAOAA4AAPgD/AeOBwcOBw4ADAAMHw4fDgMGBweOA/4A+A4HDgcOBw4HDgcOBw//D/8OBw4HDgcOBw4HDgcODg4ODg4ODg4ODg4ODgA4ADgAOAA4ADgAOAA4ADgAOAw4DDgOMAfwA+AODg4cDhwOOA5wDuAP4A/gD3AOOA4YDhwODg4HDgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4AD/gP+A8B74Hvg++Db8Nux27HbuZubm5sbnxuPG44bhhuAw8DD4MPgw/DDuMOYw5zDjMOOw4bDg8ODw4HAPgD/AeOBgcOAw4DjAOMA44DjgMGBweOA/wA+A/wD/gOHA4MDgwODA4cD/gP8A4ADgAOAA4ADgAA+AP8B44GBw4DDgOMA4wDjgOOMwY/B54D/AD+AAMP8A/4DhwODA4MDgwOHA/4D/AOMA44DhwOHA4OAfAH+AccDgwOAAcAB/AB+AAcAAwMDA4cB/gD8A/+D/4A4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAOBw4HDgcOBw4HDgcOBw4HDgcOBwYGB54D/AH4DAcOBw4GBgYHDgcMAwwDnAOYAZgB+AHwAPAA8AwcHAwcHA4eGA4+OAY2OAY2MAc3MAdzcANjcANjYANjYAHh4AHB4AHBwA4GBw4DHAOYAfgA8ADgAPAB8AG4A5wHDAYODgcOBw4OBw4DHAOYAbgB8ADwAGAAYABgAGAAYABgD/wP/AAcADgAMABwAOAAwAHAA4AHAAYAD/wP/A8PDAwMDAwMDAwMDAwMDAwPDwwGBgYHAwMDA4GBgYDAwMDAbw8DAwMDAwMDAwMDAwMDAw8PA4OGxsxsb/gP+AwMBgPgB/AOMAA4APgH+A44DDgMOA/4B7gOAA4ADgAO8A/4DxgOHA4cDgwOHA4cDxgP+A7wA+AH8A44DhAMAAwADAAOGA44B/AD4AAcABwAHAPcB/wOPA4cDBwMHAwcDhwOPAf8A9wD4AfwDjgMGA/4D/gMAA4ADhgH+APgAePjgw/v4wMDAwMDAwMDA9wH/A48DhwMHAwcDBwOHA48B/wD3AAcBhgH+APgDgAOAA4ADvAP+A84DhgOGA4YDhgOGA4YDhgOGA4OBAAODg4ODg4ODg4ODgcHAgAHBwcHBwcHBwcHBwcHDgwOAA4ADgAOOA5wDuAOwA/AD8AO4A7gDnAOOA44Dg4ODg4ODg4ODg4ODg4O44/3zjjuOO447jjuOO447jjuOO447vAP+A84DhgOGA4YDhgOGA4YDhgOGAPgB/AOOA4YDBwMHAwcDhgOOAfwA+AO8A/4DxgOHA4cDgwOHA4cDxgP+A7wDgAOAA4ADgAD3Af8DjwOHAwcDBwMHA4cDjwH/APcABwAHAAcABwOz88ODg4ODg4ODgPgB/AOMA4AD4AH8ADwADgOOA/wA+ADAw/PwwMDAwMDAwPBzhgOGA4YDhgOGA4YDhgOGA44B/gD2AwcDBgOOAY4BjAHcANgA2ADYAHAAcAMMMxwznnOecZ5hkmGz4PPA88DhwOHDjgGMAdwA2ADwAHAA+ADYAdwDjAMOAwcDBgOOAY4BjAHcANgA2ADYAHAAcABwAGAB4APAA/wD/AAcADgAMABwAOAAwAHAA/4D/gA4eGDg4ODgw4PAwODg4ODgeDuDg4ODg4ODg4ODg4ODg4ODg4ODg4ODgwPAwMDAwMDgcHDgwMDAwMPDAAMA8wH/AZ4DAAB3AO4BzAGYA7gBnADMAGYAcwDh8xMbMfDjA4MDuAHcAM4AZgB3AOYAzAGcA7gAcAAwABgAAAA8ADwAfABuAG4A5gDnAMcBwwH/gf+DgYOBwwHADAAMABgAAAA8ADwAfABuAG4A5gDnAMcBwwH/gf+DgYOBwwHAOAB8AGYAAAA8ADwAfABuAG4A5gDnAMcBwwH/gf+DgYOBwwHAdgB+AAAAAAA8ADwAfABuAG4A5gDnAMcBwwH/gf+DgYOBwwHAZgBmAAAAAAA8ADwAfABuAG4A5gDnAMcBwwH/gf+DgYOBwwHAPABkAGQAPAAAADwAPAB8AG4AbgDmAOcAxwHDAf+B/4OBg4HDAcAf/gAf/gAbgAA7gAAzgABzgABj/gDj/gDjgAH/gAH/gAGDgAOD/gMD/gA+AP8B44HBw4DDgAMAAwADgAOAwYHB44D/AD4ACAAcAAYAHABgAGAAMAAAA/4D/gOAA4ADgAOAA/4D/gOAA4ADgAOAA/4D/gAYABgAMAAAA/4D/gOAA4ADgAOAA/4D/gOAA4ADgAOAA/4D/gBwAHgAzAAAA/4D/gOAA4ADgAOAA/4D/gOAA4ADgAOAA/4D/gDMAMwAAAAAA/4D/gOAA4ADgAOAA/4D/gOAA4ADgAOAA/4D/gMBgIABwcHBwcHBwcHBwcHBwcDBgYADg4ODg4ODg4ODg4ODg4DhsxgA4ODg4ODg4ODg4ODg4OGbuRAA4ODg4ODg4ODg4ODg4OD/AP+AwcDA4MDgwGP8Y/xgwGDA4MDgwcD/gP8AMgB+AAAAAAOAw8DD4MPgw/DDuMOYw5zDjMOOw4bDg8ODw4HAMAAYABgAAAA+AP8B44GBw4DDgOMA4wDjgOOAwYHB44D/AD4ADgAMAAgAAAA+AP8B44GBw4DDgOMA4wDjgOOAwYHB44D/AD4AHAA2AGcAAAA+AP8B44GBw4DDgOMA4wDjgOOAwYHB44D/AD4AMgB+AAAAAAA+AP8B44GBw4DDgOMA4wDjgOOAwYHB44D/AD4AZgB3ACIAAAA+AP8B44GBw4DDgOMA4wDjgOOAwYHB44D/AD4BBAOOAdwA+ABwAPgB3AOOAwYAPsD/geOBg8OGw4zjDOMY47DjoMHhweOB/wG+ADAAMAAYAAADgcOBw4HDgcOBw4HDgcOBw4HDgcGBgeeA/wB+AAwADAAYAAADgcOBw4HDgcOBw4HDgcOBw4HDgcGBgeeA/wB+ABgAPABmAAADgcOBw4HDgcOBw4HDgcOBw4HDgcGBgeeA/wB+AGYAZgAAAAADgcOBw4HDgcOBw4HDgcOBw4HDgcGBgeeA/wB+AAwAHAAYAAADgcODgcOAxwDmAG4AfAA8ABgAGAAYABgAGAAYA4ADgAOAA/wD/gOHA4MDgwOHA/4D/AOAA4ADgAD4Af4BzgOGA4YDjgO8A74DhwODA4MDhwO/A7wAwABgAGAAAAD4AfwDjAAOAD4B/gOOAw4DDgP+Ae4AGAAwACAAAAD4AfwDjAAOAD4B/gOOAw4DDgP+Ae4AcADYAZwAAAD4AfwDjAAOAD4B/gOOAw4DDgP+Ae4A6AH4AAAAAAD4AfwDjAAOAD4B/gOOAw4DDgP+Ae4BmAHcAIgAAAD4AfwDjAAOAD4B/gOOAw4DDgP+Ae4AcACYAJgAcAAAAPgB/AOMAA4APgH+A44DDgMOA/4B7gD54f/zjjgOGH/9//+MAw4DDhv/+fHg+AH8A44DhAMAAwADAAOGA44B/AD4ACAAOAAIADgAwABgACAAAAD4AfwDjgMGA/4D/gMAA4ADhgH+APgAGAAwADAAAAD4AfwDjgMGA/4D/gMAA4ADhgH+APgAcADYAcwAAAD4AfwDjgMGA/4D/gMAA4ADhgH+APgAzAHcAIgAAAD4AfwDjgMGA/4D/gMAA4ADhgH+APgDAYGAAcHBwcHBwcHBwcHAwYGAA4ODg4ODg4ODg4OA4bMYAODg4ODg4ODg4ODjO7kQAODg4ODg4ODg4ODghAD8AHAA2AAMAP4B/gOOAwYDBgMGAwYDjgH8APgA7AD4AAAAAAO8A/4DzgOGA4YDhgOGA4YDhgOGA4YA4ABgADAAAAD4AfwDjgOGAwcDBwMHA4YDjgH8APgAGAAwADAAAAD4AfwDjgOGAwcDBwMHA4YDjgH8APgAcADYAcwAAAD4AfwDjgOGAwcDBwMHA4YDjgH8APgA7AC4AAAAAAD4AfwDjgOGAwcDBwMHA4YDjgH8APgAzAHMAIgAAAD4AfwDjgOGAwcDBwMHA4YDjgH8APgAYABwAGAAAAAAA/4D/gAAAGAAcABgAPsB/gOOA44DFwM3A2cDxgOOAfwC+ADgAGAAMAAAA4YDhgOGA4YDhgOGA4YDhgOOAf4A9gAYABgAMAAAA4YDhgOGA4YDhgOGA4YDhgOOAf4A9gBwAPgBzAAAA4YDhgOGA4YDhgOGA4YDhgOOAf4A9gDMAMwAiAAAA4YDhgOGA4YDhgOGA4YDhgOOAf4A9gAYADAAMAAAAwcDBgOOAY4BjAHcANgA2ADYAHAAcABwAGAB4APAA4ADgAOAA7wD/gPGA4cDhwODA4cDhwPGA/4DvAOAA4ADgAOAAMwB3ACIAAADBwMGA44BjgGMAdwA2ADYANgAcABwAHAAYAHgA8AAzADMAAAAAAP+A/4DgAOAA4ADgAP+A/4DgAOAA4ADgAP+A/4APAA8AHwAbgBuAOYA5wDHAcMB/4H/g4GDgcMBw/4D/gOAA4ADgAOAA/wD/wOHA4MDgwOHA/8D/AP8A/4DhwODA4MDhwP8A/8DgwODg4ODhwP/A/4D/gP+A4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAAH/gf+Bw4HDgcOBg4GDgYOBg4ODg4OHA4//z//MAMwAzADP+A/4DgAOAA4ADgAP+A/4DgAOAA4ADgAP+A/4DgwcBww4BwxwA4xwAYzgAczAAP/AAf/AAYzgA4xgAwxwBww4Dgw4DgwcAeAH+AYYDhwAHAA4APAA+AAcAAwOHA4cB/gD8A4HDg8ODw4bDjsOMw5zDmcO5w/HD4cPhw8HDgcBmADwAAAAAA4HDg8ODw4bDjsOMw5zDmcO5w/HD4cPhw8HDgcODg4ODhwOOA4wDnAP4A/gDnAOOA44DhwODg4GAf8B/wGHA4cDhwOHA4cDhwMHAwcDBwcHDgcMBw8B74Hvg++Db8Nux27HbuZubm5sbnxuPG44bhhuBw4HDgcOBw4HDgcP/w//DgcOBw4HDgcOBw4HAPgD/AeOBgcOAw4DjAOMA44DjgMGBweOA/wA+A//D/8OBw4HDgcOBw4HDgcOBw4HDgcOBw4HDgcP8A/4DhwODA4MDgwOHA/4D/AOAA4ADgAOAA4AAPgD/AeOBgcOAw4ADAAMAA4ADgMGBweOA/wA+A/+D/4A4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAODg4OBgwHHAMYA7gBuAGwAfAA4ADgAMAHwAeAADAA+AP/B7eGMY4xzDHMMcwxzjHHM4P/Af4AMAAwDgYHDgMcA5gB+ADwAOAA8AHwAbgDnAcMBg4OBw4GDgYOBg4GDgYOBg4GDgYOBg4GDgYOBg//j/+AA4ADgAOOBg4GDgYOBg4GDgYHDgf+A/YABgAGAAYABgAGDhw+HD4cPhw+HD4cPhw+HD4cPhw+HD4cP/////4cMA4cMA4cMA4cMA4cMA4cMA4cMA4cMA4cMA4cMA4cMA4cMA///A///AAAHAAAHAAAHA/AD8AAwADAAMAA/gD/gMOAwcDBwMHAw4D/gP4OAO4A7gDuAO4A7/Dv/O4c7g7uDu4O7hzv/O/w7gAOAA4ADgAOAA/wD/wOHA4ODg4ODg4cD/wP8AHwA/wHHg4GDAcABwD/AP8ABwwHDgYHHgP8AfAOB8AOH+AOPHAOODgOcBgOcBwP4BwP4BwOcBwOcBgOMDgOPHAOH/AOB8AD/Af8DgwODAwMDgwODAf8A/wDjAcMBwwODAwMA+AH8A4wADgA+Af4DjgMOAw4D/gHuAH4B/gGAAwADeAP+A44DBwMHAwcDhgOOAfwA+AP4A/wDjgOMA/wD/AOOA4YDhgP+A/wD+/uDg4ODg4ODg4B/AH8AYwBjAOMA4wDDAMMAwwP/w//DgMOAw4DA+AH8A44DBgP+A/4DAAOAA4YB/gD4A4xxjGHM4O3Af4B/gO3AzMHM44xzjHDz+xwceHgcHx/584YDjgOOA54DvgO2A+YD5gPGA4YDhgDMAHgAAAAAA4YDjgOOA54DvgO2A+YD5gPGA4YDhgOOA44DnAOYA7gD8APwA7gDnAOOA44A/wD/AOMA4wDDAMMAwwDDAMMDwwODA8HjwePjY+Nj82O3Y7ZjtmOcY5xjnGOGA4YDhgOGA/4D/gOGA4YDhgOGA4YA+AH8A44DhgMHAwcDBwOGA44B/AD4A/4D/gOGA4YDhgOGA4YDhgOGA4YDhgO8A/4DxgOHA4cDgwOHA4cDxgP+A7wDgAOAA4ADgAD4AfwDjgOEAwADAAMAA4YDjgH8APgD/gP+AHAAcABwAHAAcABwAHAAcABwAwcDBgOOAY4BjAHcANgA2ADYAHAAcABwAGAB4APAABgAGAAYAH8B/4GZw5jDGMMY4xjDmMHZwf+AfwAYABgAGAOOAYwB3ADYAPAAcAD4ANgB3AOMAw4DhgOGA4YDhgOGA4YDhgOGA4YD/4P/gAOAA4ADg4YDhgOGA4YDhgOGAf4A/gAGAAYABgOMc4xzjHOMc4xzjHOMc4xzjHP/8//zjHOMc4xzjHOMc4xzjHOMc4xz//v/+AAYABgAG+AD4ABgAGAAfwB/gGHAYcBhwH+AfwOA44DjgOOA4/jj/uOO44bjjuP+4/jjgAOAA4ADgAP4A/4DjgOGA44D/gP4APgB/AOOAw4AfgB+AAYDDgOMAfwA+AOHw4/jnHOYM/gz+DOYM5gznHOP44fA/gP+A44DDgMOA/4B/gHOAY4DjgMOAMwB3ACIAAAA+AH8A44DBgP+A/4DAAOAA4YB/gD4A/8D/wP//4P//4GBgwMDAwODAwMDAgGZmzMzMzO7MzMzImMMM447DDODngODvwPDsQPDsYPjsQOzvwOzngObgAObvwOPvwOPgAOHgAODgAODgAA==" }, big: { ascent: 33, descent: 9, lineHeight: 42, glyphs: { " ": [8, 0, 0, 0, 0, 0], ",": [11, 2, 29, 6, 10, 0], "-": [16, 2, 21, 12, 4, 10], ".": [11, 3, 27, 6, 6, 18], "0": [23, 2, 8, 19, 25, 24], "1": [15, 2, 8, 10, 25, 99], "2": [21, 2, 8, 18, 25, 149], "3": [22, 2, 8, 18, 25, 224], "4": [23, 2, 8, 19, 25, 299], "5": [22, 2, 8, 18, 25, 374], "6": [22, 2, 8, 19, 25, 449], "7": [20, 1, 8, 18, 25, 524], "8": [22, 2, 8, 19, 25, 599], "9": [22, 2, 7, 19, 25, 674], ":": [11, 3, 15, 6, 18, 749], h: [21, 2, 8, 17, 25, 767], i: [9, 2, 6, 5, 26, 842], k: [20, 2, 8, 17, 25, 868], m: [31, 2, 14, 27, 19, 943], n: [21, 2, 14, 17, 19, 1019], "и": [21, 2, 14, 17, 19, 1076], "к": [20, 2, 14, 17, 19, 1133], "м": [28, 2, 14, 23, 19, 1190], "н": [21, 2, 14, 17, 19, 1247], "с": [20, 1, 14, 18, 19, 1304], "ч": [20, 2, 14, 16, 19, 1361], "–": [17, 0, 21, 17, 4, 1399] }, bits: "fHx8eHh4cPDw8P/w//D/8P/wMPj4/PhwA/gAD/4AH/8AP/+Afx+Afg/A/AfA+Afg+APg+APg+APg+APg+APg+APg+APg+APg+APg+Afg/AfAfg/Afx/AP/+AH/8AD/4AA/gAD8AfwH/A/8D/wPfAx8CHwAfAB8AHwAfAB8AHwAfAB8AHwAfAB8AHwAfAB8AHwAfAB8AH8AAf/AA//gB//wD+P4D4D4D4D4D4D4AAD4AAD4AAHwAAPwAAfgAA/AAB+AAD8AAH4AAPwAAfgAA/AAB+AAD//8D//8D//8D//8AD8AAf/AA//wB//4B+H4D8D4D4D4AAB4AAD4AAH4AD/wAD/AAD/gAD/wAAH4AAD8AAB8AAB8D4B8D4D8D+H8B//4A//wAf/gAH+AAAPwAAfwAA/wAA/wAB/wAD/wAD7wAHzwAHzwAPjwAfDwAfDwA+DwB8DwB8DwD4DwD//+D//+D//+D//+AAHwAAHwAAHwAAHwAAHwA//4A//4A//4A//4B8AAB8AAB8AAB8AAB88AB7/gB//wB//4B+H4AID8AAB8AAB8AAB8AAB8D4B8D8D8B+H4B//4A//wAf/AAD8AAD+AAP/gAf/wA//4A/n4B+D8B8B8D4AAD4AAD4/AD7/gD//4D//4D+D8D8B8D4B8D4A+D4A+D4B8B8B8B+H8A//4Af/wAP/gAD+AD//8D//8D//8D//8AAD4AAD4AAHwAAHwAAPgAAPgAAfAAAfAAA+AAA+AAB8AAB8AAD4AAD4AAHwAAHwAAPgAAPgAAfAAAfAAA+AAAD8AAf/gA//wB//4B+H4B8D8D4B8B4B8B8D4B+H4A//wAP/AAf/gA//wB+H4D8B8D4B8D4B+D4B+D4B8D8D8B//4A//4Af/gAH+AAH8AAf/AA//gB//wD+H4D4D4D4B8D4B8DwB8D4B8D4D8D8H+B//+B/+8Af98APx8AAB8AAB8D4D4D8H4B+PwB//wA//gAf/AAH8ABw+Pz4+DAAAAAAAAAw+Pj8+HD4AAD4AAD4AAD4AAD4AAD4AAD4+AD5/gD7/wD//wD+P4D8H4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4Bw+Pj4cAAA+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+PgAAPgAAPgAAPgAAPgAAPgAAPgfgPg/APh+APh8APj4APn4APvwAP/gAP/AAP/gAP/wAP3wAPn4APj8APh+APh+APg/APgfgPgfgPjwPwD7/H+A+/z/wP///8D+P8/g/B8H4PgfA+D4HwPg+B8D4PgfA+D4HwPg+B8D4PgfA+D4HwPg+B8D4PgfA+D4HwPg+B8D4PgfA+D4+AD5/gD7/wD//wD+P4D8H4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4H4D4P4D4P4D4f4D4/4D4/4D574D774D7z4D/j4D/j4D/D4D+D4D+D4D8D4D4D4D4D4D4H4D4H4D4PwD4fgD4fgD4/AD5+AD58AD/8AD/4AD/8AD/8AD5+AD4/AD4fAD4fgD4PwD4H4D4H4D/AP7/Af7/gf7/gf7/g/7/w97/w977x97759775575557575757x74/x74/h74/h74fh74fB74PB74D4D4D4D4D4D4D4D4D4D4D4D4D4D//4D//4D//4D//4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4AD+AAP/gAf/wA//4B+H4B8D8B8BwD8AAD4AAD4AAD4AAD8AAB8BwB8D8B+H4A//4Af/wAP/gAD+AD4H/gf+B/4H/gf+B/4H/gf/B9//3//P/8H/wAfAB8AHwAfAB8AH///gP//gP//gP//gA==" } };

  // src/background/glassdraw.ts
  var G1_BMP_W = 576;
  var G1_BMP_H = 135;
  var G1_SAFE = { x: 50, y: 35, w: 526, h: 100 };

  class Canvas {
    w;
    h;
    px;
    constructor(w, h) {
      this.w = w;
      this.h = h;
      this.px = new Uint8Array(w * h);
    }
    set(x, y, v = 1) {
      x = Math.round(x);
      y = Math.round(y);
      if (x < 0 || y < 0 || x >= this.w || y >= this.h)
        return;
      this.px[y * this.w + x] = v;
    }
    get(x, y) {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h)
        return 0;
      return this.px[y * this.w + x];
    }
    disc(cx, cy, r, v = 1) {
      const ri = Math.ceil(r);
      const r2 = r * r;
      for (let dy = -ri;dy <= ri; dy++)
        for (let dx = -ri;dx <= ri; dx++)
          if (dx * dx + dy * dy <= r2)
            this.set(cx + dx, cy + dy, v);
    }
    ring(cx, cy, r, t = 2, v = 1) {
      const ro = r * r;
      const ri = Math.max(0, r - t) ** 2;
      const n = Math.ceil(r);
      for (let dy = -n;dy <= n; dy++)
        for (let dx = -n;dx <= n; dx++) {
          const d = dx * dx + dy * dy;
          if (d <= ro && d >= ri)
            this.set(cx + dx, cy + dy, v);
        }
    }
    line(x0, y0, x1, y1, t = 1, v = 1, dash) {
      const len = Math.hypot(x1 - x0, y1 - y0);
      const steps = Math.max(1, Math.ceil(len * 2));
      const r = (t - 1) / 2;
      const period = dash ? dash[0] + dash[1] : 0;
      for (let i = 0;i <= steps; i++) {
        const s = i / steps;
        if (dash && s * len % period >= dash[0])
          continue;
        const x = x0 + (x1 - x0) * s;
        const y = y0 + (y1 - y0) * s;
        if (r <= 0)
          this.set(x, y, v);
        else
          this.disc(x, y, r + 0.35, v);
      }
    }
    polyline(pts, t = 1, v = 1, dash) {
      for (let i = 1;i < pts.length; i++)
        this.line(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, t, v, dash);
    }
    triangle(ax, ay, bx, by, cx, cy, v = 1) {
      const minX = Math.floor(Math.min(ax, bx, cx));
      const maxX = Math.ceil(Math.max(ax, bx, cx));
      const minY = Math.floor(Math.min(ay, by, cy));
      const maxY = Math.ceil(Math.max(ay, by, cy));
      const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
      if (area === 0)
        return;
      for (let y = minY;y <= maxY; y++)
        for (let x = minX;x <= maxX; x++) {
          const px = x + 0.5;
          const py = y + 0.5;
          const w0 = ((bx - px) * (cy - py) - (cx - px) * (by - py)) / area;
          const w1 = ((cx - px) * (ay - py) - (ax - px) * (cy - py)) / area;
          if (w0 >= -0.01 && w1 >= -0.01 && 1 - w0 - w1 >= -0.01)
            this.set(x, y, v);
        }
    }
    frame(x, y, w, h, radius = 6, t = 2) {
      const r = Math.min(radius, w / 2, h / 2);
      for (let k = 0;k < t; k++) {
        this.line(x + r, y + k, x + w - 1 - r, y + k);
        this.line(x + r, y + h - 1 - k, x + w - 1 - r, y + h - 1 - k);
        this.line(x + k, y + r, x + k, y + h - 1 - r);
        this.line(x + w - 1 - k, y + r, x + w - 1 - k, y + h - 1 - r);
      }
      const corners = [
        [x + r, y + r, -1, -1],
        [x + w - 1 - r, y + r, 1, -1],
        [x + r, y + h - 1 - r, -1, 1],
        [x + w - 1 - r, y + h - 1 - r, 1, 1]
      ];
      for (const [cx, cy, sx, sy] of corners)
        for (let dy = 0;dy <= r; dy++)
          for (let dx = 0;dx <= r; dx++) {
            const d = Math.hypot(dx, dy);
            if (d <= r + 0.5 && d >= r - t + 0.5)
              this.set(cx + sx * dx, cy + sy * dy);
          }
    }
    fill(x, y, w, h, v = 1) {
      for (let yy = Math.max(0, y);yy < Math.min(this.h, y + h); yy++)
        for (let xx = Math.max(0, x);xx < Math.min(this.w, x + w); xx++)
          this.px[yy * this.w + xx] = v;
    }
    blit(src, x, y) {
      for (let yy = 0;yy < src.h; yy++)
        for (let xx = 0;xx < src.w; xx++)
          if (src.px[yy * src.w + xx])
            this.set(x + xx, y + yy, 1);
    }
  }
  var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  function fromBase64(s) {
    const lookup = new Int16Array(128).fill(-1);
    for (let i = 0;i < B64.length; i++)
      lookup[B64.charCodeAt(i)] = i;
    const clean = s.replace(/=+$/, "");
    const out = new Uint8Array(Math.floor(clean.length * 3 / 4));
    let o = 0;
    for (let i = 0;i < clean.length; i += 4) {
      const a = lookup[clean.charCodeAt(i)];
      const b = lookup[clean.charCodeAt(i + 1)];
      const c = i + 2 < clean.length ? lookup[clean.charCodeAt(i + 2)] : 0;
      const d = i + 3 < clean.length ? lookup[clean.charCodeAt(i + 3)] : 0;
      const n = a << 18 | b << 12 | c << 6 | d;
      if (o < out.length)
        out[o++] = n >> 16 & 255;
      if (o < out.length)
        out[o++] = n >> 8 & 255;
      if (o < out.length)
        out[o++] = n & 255;
    }
    return out;
  }
  function toBase64(bytes) {
    let out = "";
    for (let i = 0;i < bytes.length; i += 3) {
      const a = bytes[i];
      const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
      const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
      const n = a << 16 | b << 8 | c;
      out += B64[n >> 18 & 63] + B64[n >> 12 & 63];
      out += i + 1 < bytes.length ? B64[n >> 6 & 63] : "=";
      out += i + 2 < bytes.length ? B64[n & 63] : "=";
    }
    return out;
  }
  var bitsCache = {};
  function fontBits(f) {
    return bitsCache[f] ??= fromBase64(GLASS_FONTS[f].bits);
  }
  function glyphOf(f, ch) {
    const g = GLASS_FONTS[f].glyphs[ch];
    if (g)
      return g;
    const fallback = { "→": ">", "←": "<", "↑": "^" };
    const base = ch.normalize("NFD")[0];
    const alt = fallback[ch] ?? (base !== ch ? base : "?");
    return GLASS_FONTS[f].glyphs[alt] ?? null;
  }
  function lineHeight(f) {
    return GLASS_FONTS[f].lineHeight;
  }
  function measure(text, f) {
    let w = 0;
    for (const ch of text)
      w += glyphOf(f, ch)?.[0] ?? 0;
    return w;
  }
  function fit(text, f, maxW) {
    if (measure(text, f) <= maxW)
      return text;
    const ell = "…";
    const chars = [...text];
    while (chars.length && measure(chars.join("").trimEnd() + ell, f) > maxW)
      chars.pop();
    return chars.length ? chars.join("").trimEnd() + ell : "";
  }
  function drawText(c, text, x, y, f, v = 1) {
    const bits = fontBits(f);
    let pen = x;
    for (const ch of text) {
      const g = glyphOf(f, ch);
      if (!g)
        continue;
      const [advance, xoff, yoff, w, h, start] = g;
      const rowBytes = w + 7 >> 3;
      for (let yy = 0;yy < h; yy++)
        for (let xx = 0;xx < w; xx++)
          if (bits[start + yy * rowBytes + (xx >> 3)] & 128 >> (xx & 7))
            c.set(pen + xoff + xx, y + yoff + yy, v);
      pen += advance;
    }
    return pen - x;
  }
  function capTop(f) {
    return (glyphOf(f, "H") ?? glyphOf(f, "0"))?.[2] ?? 0;
  }
  function encodeG1Bmp(c) {
    const W = G1_BMP_W;
    const H = G1_BMP_H;
    const rowSize = Math.ceil(W / 32) * 4;
    const pixelBytes = rowSize * H;
    const header = 62;
    const buf = new Uint8Array(header + pixelBytes);
    const u16 = (o, v) => {
      buf[o] = v & 255;
      buf[o + 1] = v >> 8 & 255;
    };
    const u32 = (o, v) => {
      u16(o, v & 65535);
      u16(o + 2, v >>> 16 & 65535);
    };
    buf[0] = 66;
    buf[1] = 77;
    u32(2, buf.length);
    u32(10, header);
    u32(14, 40);
    u32(18, W);
    u32(22, H);
    u16(26, 1);
    u16(28, 1);
    u32(30, 0);
    u32(34, pixelBytes);
    u32(38, 2835);
    u32(42, 2835);
    u32(46, 2);
    u32(50, 2);
    buf[58] = 255;
    buf[59] = 255;
    buf[60] = 255;
    for (let y = 0;y < H; y++) {
      const row = header + (H - 1 - y) * rowSize;
      for (let x = 0;x < W; x++) {
        const lit = x < c.w && y < c.h && c.px[y * c.w + x] === 1;
        if (!lit)
          buf[row + (x >> 3)] |= 128 >> (x & 7);
      }
    }
    return toBase64(buf);
  }
  function g1Canvas() {
    return new Canvas(G1_BMP_W, G1_BMP_H);
  }
  function testPattern(label = "EVA-IA · карта") {
    const c = g1Canvas();
    const s = G1_SAFE;
    c.frame(s.x, s.y, s.w, s.h, 8, 2);
    for (const [x, y] of [
      [0, 0],
      [G1_BMP_W - 12, 0],
      [0, G1_BMP_H - 12],
      [G1_BMP_W - 12, G1_BMP_H - 12]
    ])
      c.fill(x, y, 12, 12);
    const w = measure(label, "text");
    drawText(c, label, s.x + (s.w - w) / 2, s.y + (s.h - lineHeight("text")) / 2, "text");
    return encodeG1Bmp(c);
  }

  // src/background/navmap.ts
  var R_EARTH = 6371000;
  var rad = (d) => d * Math.PI / 180;
  function distanceM(a, b) {
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(s)));
  }
  function bearing(a, b) {
    const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
    const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }
  function toLocal(p, o) {
    return { x: rad(p.lng - o.lng) * R_EARTH * Math.cos(rad(o.lat)), y: rad(p.lat - o.lat) * R_EARTH };
  }
  function nearestOnRoute(route, me) {
    if (route.length < 2)
      return null;
    let best = { index: 0, dist: Infinity, along: 0 };
    let along = 0;
    for (let i = 0;i < route.length - 1; i++) {
      const a = toLocal(route[i], me);
      const b = toLocal(route[i + 1], me);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      const t = len2 > 0 ? Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / len2)) : 0;
      const d = Math.hypot(a.x + dx * t, a.y + dy * t);
      const segLen = Math.sqrt(len2);
      if (d < best.dist)
        best = { index: i, dist: d, along: along + segLen * t };
      along += segLen;
    }
    return best;
  }
  function pointAhead(route, me, ahead) {
    const n = nearestOnRoute(route, me);
    if (!n)
      return null;
    const target = n.along + ahead;
    let along = 0;
    for (let i = 0;i < route.length - 1; i++) {
      const seg = distanceM(route[i], route[i + 1]);
      if (along + seg >= target && seg > 0) {
        const t = (target - along) / seg;
        return { lat: route[i].lat + (route[i + 1].lat - route[i].lat) * t, lng: route[i].lng + (route[i + 1].lng - route[i].lng) * t };
      }
      along += seg;
    }
    return route[route.length - 1];
  }
  function travelHeading(route, me, prev) {
    const n = nearestOnRoute(route, me);
    if (n && n.dist < 40) {
      const ahead = pointAhead(route, me, 35);
      if (ahead && distanceM(me, ahead) > 3)
        return bearing(me, ahead);
    }
    if (prev && distanceM(prev, me) > 8)
      return bearing(prev, me);
    return null;
  }
  var MAP_RADIUS = { walking: 500, cycling: 800, driving: 1400 };
  var MAP_SCALE = { walking: 2, cycling: 3.5, driving: 7 };
  var MAP_BOX = { x: G1_SAFE.x + G1_SAFE.w - 184, y: G1_SAFE.y, w: 182, h: G1_SAFE.h };
  function clip(x0, y0, x1, y1, w, h) {
    let t0 = 0;
    let t1 = 1;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const edges = [
      [-dx, x0 + 2],
      [dx, w + 2 - x0],
      [-dy, y0 + 2],
      [dy, h + 2 - y0]
    ];
    for (const [p, q] of edges) {
      if (p === 0) {
        if (q < 0)
          return null;
      } else {
        const r = q / p;
        if (p < 0) {
          if (r > t1)
            return null;
          if (r > t0)
            t0 = r;
        } else {
          if (r < t0)
            return null;
          if (r < t1)
            t1 = r;
        }
      }
    }
    return [x0 + t0 * dx, y0 + t0 * dy, x0 + t1 * dx, y0 + t1 * dy];
  }
  var PATTERN = {
    water: (x, y) => (x + y) % 4 === 0,
    park: (x, y) => x % 6 === 0 && y % 6 === 3
  };
  function fillRings(c, rings, pattern) {
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const r of rings)
      for (const p of r) {
        if (p.y < y0)
          y0 = p.y;
        if (p.y > y1)
          y1 = p.y;
      }
    y0 = Math.max(0, Math.floor(y0));
    y1 = Math.min(c.h - 1, Math.ceil(y1));
    const xs = [];
    for (let y = y0;y <= y1; y++) {
      const sy = y + 0.5;
      xs.length = 0;
      for (const r of rings)
        for (let i = 0, j = r.length - 1;i < r.length; j = i++) {
          const a = r[i];
          const b = r[j];
          if (a.y > sy !== b.y > sy)
            xs.push(a.x + (sy - a.y) * (b.x - a.x) / (b.y - a.y));
        }
      xs.sort((m, n) => m - n);
      for (let k = 0;k + 1 < xs.length; k += 2) {
        const from = Math.max(0, Math.ceil(xs[k] - 0.5));
        const to = Math.min(c.w - 1, Math.floor(xs[k + 1] - 0.5));
        for (let x = from;x <= to; x++)
          if (pattern(x, y))
            c.set(x, y);
      }
    }
  }
  var ROAD_STYLE = {
    major: { t: 3 },
    road: { t: 2 },
    minor: { t: 1 },
    path: { t: 1, dash: [1, 3] },
    waterway: { t: 1 }
  };
  function drawFeatures(c, s, center, scale, cos, sin, cx, cy) {
    if (!s.features.length)
      return;
    const w0 = toWorld(center.lat, center.lng);
    const mpw = metersPerWorld(center.lat);
    const reach = Math.hypot(c.w, c.h) * scale / mpw;
    const proj = (r) => {
      const out = new Array(r.length / 2);
      for (let i = 0;i < r.length; i += 2) {
        const lx = (r[i] - w0.x) * mpw;
        const ly = -(r[i + 1] - w0.y) * mpw;
        out[i / 2] = { x: cx + (lx * cos - ly * sin) / scale, y: cy - (lx * sin + ly * cos) / scale };
      }
      return out;
    };
    const near = (f) => f.b[2] >= w0.x - reach && f.b[0] <= w0.x + reach && f.b[3] >= w0.y - reach && f.b[1] <= w0.y + reach;
    const feats = s.features.filter(near);
    const lineOf = (pts, t, v, dash) => {
      for (let i = 1;i < pts.length; i++) {
        const cl = clip(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, c.w, c.h);
        if (cl)
          c.line(cl[0], cl[1], cl[2], cl[3], t, v, dash);
      }
    };
    for (const f of feats)
      if (f.k === "park" && f.poly)
        fillRings(c, f.p.map(proj), PATTERN.park);
    for (const f of feats)
      if (f.k === "water" && f.poly) {
        const rings = f.p.map(proj);
        fillRings(c, rings, PATTERN.water);
        for (const r of rings)
          lineOf(r, 1, 1);
      }
    const roads = feats.filter((f) => !f.poly && ROAD_STYLE[f.k] && !(s.mode === "driving" && (f.k === "path" || f.k === "minor")));
    const projected = roads.map((f) => ({ f, lines: f.p.map(proj) }));
    for (const { f, lines } of projected)
      if (f.k !== "path")
        for (const l of lines)
          lineOf(l, ROAD_STYLE[f.k].t + 2, 0);
    for (const { f, lines } of projected)
      for (const l of lines)
        lineOf(l, ROAD_STYLE[f.k].t, 1, ROAD_STYLE[f.k].dash);
  }
  function drawMap(s, w = MAP_BOX.w, h = MAP_BOX.h) {
    const c = new Canvas(w, h);
    const center = s.me ?? s.route[0] ?? s.dest;
    if (!center)
      return c;
    const scale = MAP_SCALE[s.mode] ?? 2;
    const hd = rad(s.heading ?? 0);
    const cos = Math.cos(hd);
    const sin = Math.sin(hd);
    const cx = w / 2;
    const cy = s.heading == null ? h / 2 : h * 0.68;
    const project = (p) => {
      const l = toLocal(p, center);
      const x = l.x * cos - l.y * sin;
      const y = l.x * sin + l.y * cos;
      return { x: cx + x / scale, y: cy - y / scale };
    };
    const seg = (pts, t, dash, v = 1) => {
      let prev = null;
      for (const p of pts) {
        const q = project(p);
        if (prev) {
          const cl = clip(prev.x, prev.y, q.x, q.y, w, h);
          if (cl)
            c.line(cl[0], cl[1], cl[2], cl[3], t, v, dash);
        }
        prev = q;
      }
    };
    drawFeatures(c, s, center, scale, cos, sin, cx, cy);
    let route = s.route;
    if (s.me && route.length > 1) {
      const n = nearestOnRoute(route, s.me);
      if (n)
        route = [s.me, ...route.slice(n.index + 1)];
    }
    seg(route, 11, undefined, 0);
    seg(route, 5);
    if (s.dest) {
      const d = project(s.dest);
      if (d.x >= -8 && d.x <= w + 8 && d.y >= -8 && d.y <= h + 8) {
        c.disc(d.x, d.y, 7, 0);
        c.ring(d.x, d.y, 6, 2);
        c.disc(d.x, d.y, 2);
      }
    }
    if (s.me) {
      const tip = { x: cx, y: cy - 9 };
      if (s.heading != null) {
        c.triangle(tip.x, tip.y - 3, cx - 9, cy + 9, cx + 9, cy + 9, 0);
        c.triangle(tip.x, tip.y, cx - 7, cy + 7, cx, cy + 3);
        c.triangle(tip.x, tip.y, cx, cy + 3, cx + 7, cy + 7);
      } else {
        c.disc(cx, cy, 7, 0);
        c.disc(cx, cy, 5);
      }
    }
    return c;
  }
  var ARROWS = {
    STRAIGHT: [[28, 54], [28, 14]],
    TURN_RIGHT: [[16, 54], [16, 28], [38, 28]],
    SLIGHT_RIGHT: [[18, 54], [18, 36], [36, 18]],
    SHARP_RIGHT: [[16, 54], [16, 16], [36, 36]],
    U_TURN: [[38, 54], [38, 24], [36, 16], [30, 11], [24, 11], [18, 16], [16, 24], [16, 34]]
  };
  var mirror = (pts) => pts.map(([x, y]) => [56 - x, y]);
  function arrowPath(maneuver) {
    switch (maneuver) {
      case "TURN_RIGHT":
      case "SLIGHT_RIGHT":
      case "SHARP_RIGHT":
      case "U_TURN":
        return ARROWS[maneuver];
      case "TURN_LEFT":
        return mirror(ARROWS.TURN_RIGHT);
      case "SLIGHT_LEFT":
        return mirror(ARROWS.SLIGHT_RIGHT);
      case "SHARP_LEFT":
        return mirror(ARROWS.SHARP_RIGHT);
      case "ARRIVE":
        return null;
      default:
        return ARROWS.STRAIGHT;
    }
  }
  function drawArrow(c, maneuver, x, y) {
    if (maneuver === "ARRIVE") {
      c.ring(x + 28, y + 28, 22, 4);
      c.disc(x + 28, y + 28, 8);
      return;
    }
    const pts = arrowPath(maneuver).map(([px, py]) => ({ x: x + px, y: y + py }));
    c.polyline(pts, 8);
    const a = pts[pts.length - 2];
    const b = pts[pts.length - 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const ux = (b.x - a.x) / len;
    const uy = (b.y - a.y) / len;
    const tip = { x: b.x + ux * 14, y: b.y + uy * 14 };
    const base = { x: b.x - ux * 2, y: b.y - uy * 2 };
    c.triangle(tip.x, tip.y, base.x - uy * 13, base.y + ux * 13, base.x + uy * 13, base.y - ux * 13);
  }
  function wrap(text, maxW, maxLines) {
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (measure(next, "text") <= maxW)
        cur = next;
      else {
        if (cur)
          lines.push(cur);
        cur = w;
      }
    }
    if (cur)
      lines.push(cur);
    if (lines.length > maxLines) {
      const kept = lines.slice(0, maxLines);
      kept[maxLines - 1] = fit(`${kept[maxLines - 1]} ${lines.slice(maxLines).join(" ")}`, "text", maxW);
      return kept;
    }
    return lines.map((l) => fit(l, "text", maxW));
  }
  function renderHud(s) {
    const c = g1Canvas();
    const S = G1_SAFE;
    const leftW = MAP_BOX.x - S.x - 10;
    const textH = lineHeight("text");
    const textCap = capTop("text");
    if (s.message) {
      const lines = wrap(s.message, leftW, 4);
      let y = S.y + Math.max(0, (S.h - lines.length * 22) / 2) - textCap;
      for (const l of lines) {
        drawText(c, l, S.x + 2, y, "text");
        y += 22;
      }
    } else {
      drawArrow(c, s.maneuver, S.x + 2, S.y + 2);
      const tx = S.x + 70;
      const tw = leftW - 70;
      drawText(c, fit(s.distance, "big", tw), tx, S.y + 2 - capTop("big"), "big");
      let y = S.y + 34 - textCap;
      if (s.verb) {
        drawText(c, fit(s.verb, "text", tw), tx, y, "text");
        y += 21;
      }
      if (s.road)
        drawText(c, fit(s.road, "text", tw), tx, y, "text");
      if (s.left)
        drawText(c, fit(s.left, "text", leftW), S.x + 2, S.y + S.h - textH - 1, "text");
    }
    const map = drawMap(s, MAP_BOX.w - 6, MAP_BOX.h - 6);
    c.blit(map, MAP_BOX.x + 3, MAP_BOX.y + 3);
    c.frame(MAP_BOX.x, MAP_BOX.y, MAP_BOX.w, MAP_BOX.h, 10, 2);
    return encodeG1Bmp(c);
  }

  // src/background/navigator.ts
  var MAP_FRAME_MS = { walking: 4000, cycling: 3000, driving: 3000 };
  var MAP_FRAME_SOON_MS = 1500;
  var ROADS_RELOAD_SHARE = 0.45;
  var ROADS_RETRY_MS = 20000;
  var ROADS_FAIL_RETRY_MS = 90000;
  var URGENT_METERS = { walking: 30, cycling: 60, driving: 200 };
  var MIN_REPAINT_MS = 1500;
  var ARRIVED_STOP_MS = 15000;
  var MODE_RU = { walking: "пешком", driving: "на машине", cycling: "на велосипеде" };
  function modeLabel(m) {
    return MODE_RU[m];
  }
  function formatDistance(m) {
    if (!Number.isFinite(m) || m < 0)
      return "";
    if (m < 200)
      return `${Math.max(10, Math.round(m / 10) * 10)} м`;
    if (m < 1000)
      return `${Math.round(m / 50) * 50} м`;
    return `${(Math.round(m / 100) / 10).toString().replace(".", ",")} км`;
  }
  function formatDuration(s) {
    if (!Number.isFinite(s) || s < 0)
      return "";
    const min = Math.max(1, Math.round(s / 60));
    if (min < 60)
      return `${min} мин`;
    const h = Math.floor(min / 60);
    const rest = min % 60;
    return rest ? `${h} ч ${rest} мин` : `${h} ч`;
  }
  function turnPhrase(type) {
    switch (type) {
      case "TURN_LEFT":
        return { arrow: "←", text: "Налево" };
      case "TURN_RIGHT":
        return { arrow: "→", text: "Направо" };
      case "SLIGHT_LEFT":
        return { arrow: "←", text: "Левее" };
      case "SLIGHT_RIGHT":
        return { arrow: "→", text: "Правее" };
      case "SHARP_LEFT":
        return { arrow: "←", text: "Резко налево" };
      case "SHARP_RIGHT":
        return { arrow: "→", text: "Резко направо" };
      case "U_TURN":
        return { arrow: "↓", text: "Развернитесь" };
      case "CROSS_STREET":
        return { arrow: "↑", text: "Перейдите улицу" };
      case "ARRIVE":
        return { arrow: "•", text: "Прибытие" };
      case "DEPART":
        return { arrow: "↑", text: "Начните движение" };
      default:
        return { arrow: "↑", text: "Прямо" };
    }
  }
  function maneuverScreen(u, dest) {
    const { arrow, text } = turnPhrase(u.maneuverType);
    const d = formatDistance(u.distanceMeters);
    const straight = text === "Прямо";
    const first = u.distanceMeters >= 0 && u.distanceMeters <= 15 && !straight ? `${arrow} ${text} сейчас` : d ? straight ? `${arrow} Прямо ${d}` : `${arrow} ${text} через ${d}` : `${arrow} ${text}`;
    const road = (u.nextStepRoad || u.toRoad || "").trim();
    const lines = [first];
    if (road)
      lines.push(`на ${road}`);
    const left = [formatDistance(u.distanceToDestinationMeters ?? -1), formatDuration(u.timeToDestinationSeconds ?? -1)].filter(Boolean);
    lines.push(left.length ? `${dest}: ${left.join(", ")}` : dest);
    return lines.join(`
`);
  }
  function shortPlace(name, max = 26) {
    const n = String(name ?? "").replace(/\s+/g, " ").trim();
    if (n.length <= max)
      return n;
    const cut = n.split(/,|\s[-–—]\s/)[0].trim();
    if (cut.length <= max)
      return cut;
    const words = cut.split(" ");
    let out = "";
    for (const w of words) {
      if ((out ? out.length + 1 : 0) + w.length > max - 1)
        break;
      out = out ? `${out} ${w}` : w;
    }
    return `${out || cut.slice(0, max - 1)}…`;
  }
  function buildMapQueryPrompt(query, near) {
    const system = [
      "Ты помогаешь навигатору. Пользователь голосом назвал место, куда хочет попасть; распознавание речи могло исказить название.",
      "Верни одну строку для поиска на карте рядом с пользователем:",
      "— название места так, как оно написано на картах в этой стране (в Ирландии, Англии, США — по-английски), в именительном падеже;",
      "— для адреса — адрес на местном языке;",
      "— для типа места («аптека», «ближайшее кафе») — тип места на местном языке (pharmacy, cafe).",
      "Только строка поиска, без кавычек и пояснений."
    ].join(`
`);
    const where = near ? `
Пользователь сейчас у точки ${near.lat.toFixed(3)}, ${near.lng.toFixed(3)}.` : "";
    return { system, user: `Место: ${query}${where}` };
  }
  function cleanMapQuery(reply) {
    const line = String(reply ?? "").split(`
`).map((l) => l.trim()).find(Boolean);
    if (!line)
      return "";
    return line.replace(/^(?:строка поиска|поиск|запрос|query)\s*:\s*/iu, "").replace(/[.。]+$/u, "").replace(/^[«"“„'`]+|[»"”'`]+$/gu, "").replace(/[.。]+$/u, "").trim().slice(0, 80);
  }
  function explainNavError(raw) {
    const e = String(raw ?? "").trim();
    if (!e)
      return "ошибка навигации";
    if (/LOCATION permission not declared/i.test(e))
      return "нет разрешения на геопозицию — переустановите мини‑приложение";
    if (/not granted|denied/i.test(e))
      return "нет доступа к геопозиции — разрешите Mentra доступ к местоположению в настройках iPhone";
    if (/no GPS fix|location/i.test(e))
      return "не удалось определить, где вы (GPS)";
    if (/disabled by this deployment|not configured|NOT_IMPLEMENTED/i.test(e))
      return "навигация недоступна в этой версии Mentra";
    if (/terms|T&C|accept/i.test(e))
      return "примите условия навигации в Mentra";
    if (/timeout|timed out/i.test(e))
      return "Mentra не ответила вовремя";
    return e.slice(0, 120);
  }

  class Navigator {
    deps;
    active = false;
    dest = null;
    mode = "walking";
    screen = "";
    message = "";
    last = null;
    busy = false;
    route = [];
    me = null;
    heading = null;
    roads = [];
    roadsVersion = 0;
    frame = "";
    frameId = 0;
    trip = 0;
    anchor = null;
    pendingRoute = null;
    hudMessage = "";
    roadsCenter = null;
    roadsMode = null;
    roadsBusy = false;
    roadsNextTry = 0;
    roadsFailed = false;
    frameAt = 0;
    frameTimer = null;
    unwatch = null;
    lastPaint = 0;
    paintTimer = null;
    pendingText = "";
    urgentKey = "";
    arrivedTimer = null;
    constructor(deps) {
      this.deps = deps;
    }
    async go(query, mode) {
      const trip = ++this.trip;
      this.busy = true;
      this.say(`Ищу: ${query}…`);
      let place = null;
      try {
        place = await this.deps.search(query);
      } catch (e) {
        if (trip !== this.trip)
          return;
        this.busy = false;
        return this.fail(`Поиск не удался: ${explainNavError(e?.message ?? e)}`);
      }
      if (trip !== this.trip)
        return;
      if (!place) {
        this.busy = false;
        return this.fail(`Не нашёл «${query}». Скажите название точнее.`);
      }
      await this.startTrip(place, mode, trip);
    }
    async goTo(place, mode) {
      const trip = ++this.trip;
      this.busy = true;
      this.deps.onChange();
      await this.startTrip(place, mode, trip);
    }
    async resume(t) {
      const trip = ++this.trip;
      this.busy = true;
      this.deps.log("nav", `Продолжаю маршрут до ${t.dest.name}`);
      await this.startTrip(t.dest, t.mode, trip, true);
    }
    stop(reason = "voice") {
      this.trip++;
      const wasBusy = this.busy;
      this.busy = false;
      if (this.arrivedTimer != null)
        this.deps.clearTimer(this.arrivedTimer);
      this.arrivedTimer = null;
      if (this.paintTimer != null)
        this.deps.clearTimer(this.paintTimer);
      this.paintTimer = null;
      this.pendingRoute = null;
      this.endMap();
      if (!this.active) {
        if (wasBusy) {
          this.message = "";
          this.deps.log("nav", "Поиск маршрута отменён");
          this.deps.onChange();
        }
        return;
      }
      this.active = false;
      try {
        this.deps.stop();
      } catch {}
      this.deps.log("nav", `Маршрут завершён${reason === "arrived" ? " — вы на месте" : reason === "ui" ? " с телефона" : ""}`);
      this.deps.save(null);
      this.screen = "";
      this.last = null;
      this.deps.ended();
      this.deps.onChange();
    }
    left() {
      const u = this.last;
      if (!this.active || !u)
        return "";
      return [formatDistance(u.distanceToDestinationMeters ?? -1), formatDuration(u.timeToDestinationSeconds ?? -1)].filter(Boolean).join(", ");
    }
    status() {
      if (!this.active || !this.dest)
        return "Маршрута нет.";
      const left = this.left();
      const name = shortPlace(this.dest.name);
      return left ? `${name}
Осталось ${left}` : `${name}
Считаю маршрут…`;
    }
    onUpdate(u) {
      if (!this.active || !this.dest || this.busy)
        return;
      const dest = shortPlace(this.dest.name);
      switch (u?.kind) {
        case "maneuver": {
          const prevKey = this.last ? `${this.last.maneuverType}|${this.last.nextStepRoad ?? this.last.toRoad ?? ""}` : "";
          this.last = u;
          this.hudMessage = "";
          const text = maneuverScreen(u, dest);
          const key = `${u.maneuverType}|${u.nextStepRoad ?? u.toRoad ?? ""}`;
          this.hud(key !== prevKey);
          const urgent = u.distanceMeters >= 0 && u.distanceMeters <= URGENT_METERS[this.mode] && u.maneuverType !== "STRAIGHT" && u.maneuverType !== "CONTINUE";
          if (urgent && key !== this.urgentKey) {
            this.urgentKey = key;
            this.paint(text, true);
          } else
            this.paint(text, false);
          break;
        }
        case "off_route":
          this.hudMessage = "Вы сошли с маршрута. Перестраиваю…";
          this.hud(true);
          this.paint(`Вы сошли с маршрута
Перестраиваю…
${dest}`, true);
          break;
        case "rerouting":
          this.hudMessage = "Перестраиваю маршрут…";
          this.hud(true);
          this.paint(`Перестраиваю маршрут…
${dest}`, false);
          break;
        case "arrived":
          this.deps.log("nav", `Прибытие: ${dest}`);
          this.hudMessage = `Вы на месте: ${dest}`;
          this.hud(true);
          this.paint(`Вы на месте
${dest}`, true);
          if (this.arrivedTimer == null) {
            this.arrivedTimer = this.deps.setTimer(() => {
              this.arrivedTimer = null;
              this.stop("arrived");
            }, ARRIVED_STOP_MS);
          }
          break;
        case "error":
          this.stop("error");
          this.fail(`Навигация остановлена: ${explainNavError(u.message)}`);
          break;
      }
    }
    async startTrip(place, mode, trip, quiet = false) {
      if (!quiet)
        this.say(`Маршрут до ${shortPlace(place.name)}
${modeLabel(mode)}…`);
      if (this.active) {
        this.active = false;
        this.last = null;
        try {
          this.deps.stop();
        } catch {}
        this.deps.log("nav", "Прежний маршрут завершён");
      }
      let res;
      try {
        res = await this.deps.start(place, mode);
      } catch (e) {
        res = { ok: false, error: String(e?.message ?? e) };
      }
      if (trip !== this.trip)
        return;
      this.busy = false;
      if (!res.ok) {
        this.endMap();
        this.deps.save(null);
        if (!quiet)
          return this.fail(`Маршрут не построен: ${explainNavError(res.error)}`);
        this.deps.log("info", `Прежний маршрут не продолжен: ${explainNavError(res.error)}`);
        this.deps.onChange();
        return;
      }
      this.active = true;
      this.dest = place;
      this.mode = mode;
      this.last = null;
      this.urgentKey = "";
      this.message = "";
      this.deps.save({ dest: place, mode, startedAt: this.deps.now() });
      this.startMap();
      if (quiet) {
        this.screen = `Маршрут до ${shortPlace(place.name)}
${modeLabel(mode)}`;
        this.deps.onChange();
        return;
      }
      this.deps.log("nav", `Маршрут до ${place.name} (${modeLabel(mode)})${place.address ? ", " + place.address : ""}`);
      this.paint(`Маршрут до ${shortPlace(place.name)}
${modeLabel(mode)}
Сейчас покажу первый поворот`, true);
      this.deps.onChange();
    }
    onRoute(points) {
      const pts = (Array.isArray(points) ? points : []).filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng));
      if (pts.length < 2)
        return;
      if (this.busy) {
        this.pendingRoute = pts;
        return;
      }
      if (!this.active)
        return;
      this.route = pts.map((p) => ({ lat: p.lat, lng: p.lng }));
      this.prefetch();
      this.maybeLoadRoads();
      this.hud(true);
      this.deps.onChange();
    }
    onPosition(p) {
      if (!this.active || !Number.isFinite(p?.lat) || !Number.isFinite(p?.lng))
        return;
      const me = { lat: p.lat, lng: p.lng };
      const h = travelHeading(this.route, me, this.anchor);
      if (h != null)
        this.heading = h;
      if (!this.anchor || distanceM(this.anchor, me) > 8)
        this.anchor = me;
      this.me = me;
      this.maybeLoadRoads();
      this.hud(false);
    }
    mapChanged() {
      if (!this.active)
        return;
      if (this.mapOn()) {
        this.maybeLoadRoads();
        this.hud(true);
      } else {
        this.cancelFrameTimer();
        this.frame = "";
        this.deps.onChange();
      }
    }
    mapOn() {
      try {
        return Boolean(this.deps.mapOn?.());
      } catch {
        return false;
      }
    }
    startMap() {
      this.route = this.pendingRoute ?? [];
      this.pendingRoute = null;
      this.me = null;
      this.anchor = null;
      this.heading = null;
      this.hudMessage = "";
      this.frame = "";
      this.frameAt = 0;
      try {
        this.unwatch?.();
      } catch {}
      try {
        this.unwatch = this.deps.watch?.((p) => this.onPosition(p)) ?? null;
      } catch (e) {
        this.unwatch = null;
        this.deps.log("info", `Геопозиция для карты: ${explainNavError(e?.message ?? e)}`);
      }
      this.prefetch();
      this.maybeLoadRoads();
      this.hud(true);
    }
    prefetch() {
      if (!this.mapOn() || this.route.length < 2)
        return;
      try {
        this.deps.prefetch?.(this.route);
      } catch {}
    }
    endMap() {
      this.cancelFrameTimer();
      try {
        this.unwatch?.();
      } catch {}
      this.unwatch = null;
      this.route = [];
      this.me = null;
      this.anchor = null;
      this.heading = null;
      this.hudMessage = "";
      this.frame = "";
    }
    maybeLoadRoads() {
      if (!this.deps.roads || !this.mapOn() || this.roadsBusy || !this.active)
        return;
      const center = this.me ?? this.route[0] ?? (this.dest ? { lat: this.dest.lat, lng: this.dest.lng } : null);
      if (!center)
        return;
      const radius = MAP_RADIUS[this.mode];
      const near = this.roadsCenter && this.roadsMode === this.mode && distanceM(this.roadsCenter, center) < radius * ROADS_RELOAD_SHARE;
      if (near)
        return;
      const now = this.deps.now();
      if (now < this.roadsNextTry)
        return;
      this.roadsBusy = true;
      this.roadsNextTry = now + ROADS_RETRY_MS;
      const mode = this.mode;
      this.deps.roads(center, radius, mode).then((roads) => {
        this.roads = roads;
        this.roadsCenter = center;
        this.roadsMode = mode;
        this.roadsVersion++;
        if (this.roadsFailed || this.roadsVersion === 1)
          this.deps.log("nav", `Карта вокруг загружена: ${roads.length} объектов`);
        this.roadsFailed = false;
        this.hud(false);
        this.deps.onChange();
      }).catch((e) => {
        this.roadsNextTry = this.deps.now() + ROADS_FAIL_RETRY_MS;
        if (!this.roadsFailed)
          this.deps.log("info", `Карта: ${String(e?.message ?? e).slice(0, 90)} — показываю только маршрут`);
        this.roadsFailed = true;
      }).finally(() => {
        this.roadsBusy = false;
      });
    }
    hud(soon) {
      if (!this.active || !this.mapOn())
        return;
      const wait = this.frameAt + (soon ? MAP_FRAME_SOON_MS : MAP_FRAME_MS[this.mode]) - this.deps.now();
      if (wait <= 0) {
        this.cancelFrameTimer();
        this.renderFrame();
        return;
      }
      if (soon)
        this.cancelFrameTimer();
      if (this.frameTimer == null) {
        this.frameTimer = this.deps.setTimer(() => {
          this.frameTimer = null;
          this.renderFrame();
        }, wait);
      }
    }
    cancelFrameTimer() {
      if (this.frameTimer != null)
        this.deps.clearTimer(this.frameTimer);
      this.frameTimer = null;
    }
    hudState() {
      if (!this.dest)
        return null;
      const u = this.last;
      const name = shortPlace(this.dest.name);
      return {
        maneuver: u?.maneuverType ?? null,
        distance: u ? formatDistance(u.distanceMeters) : "",
        verb: u ? turnPhrase(u.maneuverType).text : "",
        road: (u?.nextStepRoad || u?.toRoad || "").trim(),
        left: [this.left().replace(", ", " · "), name].filter(Boolean).join(" · "),
        message: this.hudMessage || (u ? undefined : `Маршрут до ${name}, ${modeLabel(this.mode)}`),
        me: this.me,
        heading: this.heading,
        route: this.route,
        features: this.roads,
        dest: { lat: this.dest.lat, lng: this.dest.lng },
        mode: this.mode
      };
    }
    renderFrame() {
      if (!this.active || !this.mapOn())
        return;
      const state = this.hudState();
      if (!state)
        return;
      let frame;
      try {
        frame = renderHud(state);
      } catch (e) {
        this.deps.log("error", `Карта: не нарисовалась (${String(e?.message ?? e)})`);
        return;
      }
      this.frameAt = this.deps.now();
      if (frame === this.frame)
        return;
      this.frame = frame;
      this.frameId++;
      this.deps.screen(this.screen, "route");
      this.deps.onChange();
    }
    fail(msg) {
      this.deps.log("error", msg);
      this.say(msg);
    }
    say(text) {
      this.message = text;
      this.deps.screen(text, "message");
      this.deps.onChange();
    }
    show(text, urgent) {
      this.screen = text;
      this.lastPaint = this.deps.now();
      this.deps.screen(text, urgent ? "turn" : "route");
    }
    paint(text, urgent) {
      if (text === this.screen && !urgent)
        return;
      const now = this.deps.now();
      if (urgent || now - this.lastPaint >= MIN_REPAINT_MS) {
        if (this.paintTimer != null)
          this.deps.clearTimer(this.paintTimer);
        this.paintTimer = null;
        this.show(text, urgent);
        this.deps.onChange();
        return;
      }
      this.pendingText = text;
      if (this.paintTimer == null) {
        this.paintTimer = this.deps.setTimer(() => {
          this.paintTimer = null;
          if (this.active && this.pendingText && this.pendingText !== this.screen) {
            this.show(this.pendingText, false);
            this.deps.onChange();
          }
        }, MIN_REPAINT_MS - (now - this.lastPaint));
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
    ru: { false: "Неверно", disputed: "Спорно", true: "Верно", fact: "Факт", evidence: "Довод", answer: "Ответ", quote: "Цитата" },
    en: { false: "False", disputed: "Disputed", true: "True", fact: "Fact", evidence: "Evidence", answer: "Answer", quote: "Quote" }
  };
  var TIP_BY_WORD = {
    неверно: "false",
    ошибка: "false",
    ложь: "false",
    спорно: "disputed",
    неточно: "disputed",
    верно: "true",
    правда: "true",
    факт: "fact",
    справка: "fact",
    довод: "evidence",
    доказательство: "evidence",
    аргумент: "evidence",
    данные: "evidence",
    ответ: "answer",
    цитата: "quote",
    false: "false",
    wrong: "false",
    disputed: "disputed",
    misleading: "disputed",
    true: "true",
    correct: "true",
    fact: "fact",
    evidence: "evidence",
    argument: "evidence",
    data: "evidence",
    answer: "answer",
    quote: "quote"
  };
  var CLAIM_CUE = /\d|процент|миллион|миллиард|тысяч|доказа|исследова|учён|учен|статисти|по данным|вс[её]гда|никогда|самы[йея]|впервые|first|largest|biggest|percent|million|billion|studies|research|proven|always|never|according to/iu;
  function looksLikeClaim(text) {
    const t = String(text ?? "").trim();
    return wordCount(t) >= 5 && !ENDS_WITH_QUESTION.test(t) && CLAIM_CUE.test(t);
  }
  function buildTipPrompt(context, prevTips, goal, lang) {
    const L = TIP_LABELS[lang];
    const system = [
      "Ты — аналитик и фактчекер в умных очках. Пользователь разговаривает с другим человеком; тебе дают свежую расшифровку речи (возможны ошибки распознавания). Если голоса различаются, реплики помечены «Вы:» (пользователь) и «Собеседник:»; метки могут ошибаться.",
      "Твоя задача — анализировать сказанное: проверять утверждения и подкреплять разговор фактами и доказательствами. Не предлагай, что спросить или сказать, не давай советов, как вести разговор.",
      goal.trim() ? `Цель пользователя: ${goal.trim()}. Ищи факты и доводы, которые ему в этом помогут, и проверяй утверждения, которые ему мешают.` : "",
      "Дай ОДНУ самую важную находку, до 18 слов, ровно в одной строке, по приоритету:",
      `${L.false}: <прозвучавшее утверждение ошибочно — как на самом деле, с цифрой или датой>`,
      `${L.quote}: <автор и источник прозвучавшей цитаты или крылатой фразы>`,
      `${L.disputed}: <утверждение преувеличено или данные расходятся — что говорят источники>`,
      `${L.fact}: <точная справка о только что упомянутом человеке, месте, термине, событии, числе>`,
      `${L.evidence}: <конкретный факт, цифра, исследование, закон или прецедент, подтверждающий или опровергающий позицию в разговоре>`,
      `${L.true}: <утверждение верно — чем подтверждается, если это неочевидно или собеседник сомневается>`,
      `${L.answer}: <ответ по существу, если пользователю только что задали вопрос>`,
      "Называй источник кратко в скобках, если знаешь его точно (ВОЗ, 2023; Росстат; ГК РФ ст. 475). Никогда не придумывай цифры, исследования и источники; не уверен — пиши «Спорно» или SKIP.",
      "Опирайся на последние реплики. Не повторяй прошлые находки.",
      `Пиши на ${lang === "en" ? "английском (English)" : "русском"} языке. Без Markdown и пояснений.`,
      "Если в последних репликах нет ни утверждений, которые стоит проверить, ни фактов, которые стоит уточнить (бытовой разговор, эмоции, пауза, всё уже проверено), — ответь ровно SKIP."
    ].filter(Boolean).join(`
`);
    const prev = prevTips.length ? `Прошлые находки:
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
    const label = TIP_BY_WORD[m[1].toLowerCase().replace(/ё/g, "е")];
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
        every ? `• проверка фактов раз в ${every} с` : "• подскажу, если запнётесь",
        goal ? `• цель: ${goal}` : "Выключить: «стоп беседа»"
      ];
      const en = [
        "Conversation mode",
        "• answers to factual questions",
        every ? `• fact checks every ${every} s` : "• a prompt when you trail off",
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
    onSpeech(text, who) {
      if (!this.active)
        return;
      const t = String(text ?? "").trim();
      if (!t)
        return;
      this.cancelSettle();
      this.interim = "";
      this.recent.push(who === "me" ? `Вы: ${t}` : who === "other" ? `Собеседник: ${t}` : t);
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
      this.maybeTip(looksLikeClaim(t));
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
    maybeTip(claim = false) {
      const every = this.every();
      if (!every || this.tipBusy)
        return;
      const words = this.wordsSinceTip + (this.interim ? wordCount(this.interim) : 0);
      const gap = claim ? Math.min(every, TALK_TIP_MIN_SEC) : every;
      if (words < TALK_TIP_MIN_WORDS || this.deps.now() - this.lastTipAt < gap * 1000)
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
          this.deps.log("talk", "Анализ: проверять нечего");
          return;
        }
        const line = tipLine(tip.label, tip.text, lang);
        const seen = (this.record?.notes ?? []).slice(-PREV_TIPS).some((n) => normalize(`${n.q}: ${n.text}`) === normalize(line));
        if (seen)
          return;
        this.addNote({ t: this.deps.now(), kind: "tip", q: TIP_LABELS[lang][tip.label], text: tip.text });
        this.deps.log("talk", `Анализ — ${line}`);
        if (tip.label === "false" || this.deps.now() - this.lastAnswerAt >= TALK_ANSWER_PRIORITY_MS)
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
    voiceLock: false,
    followUpSec: 0,
    translateTo: "ru-RU",
    lectureEverySec: 15,
    talkEverySec: 10,
    talkGoal: "",
    navMode: "walking",
    navMap: true,
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
  var NAV_KEY = "g1gpt.nav.v1";
  var MAP_AREAS_KEY = "g1gpt.mapAreas.v1";
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
      voiceLock: pick("voiceLock") === true,
      followUpSec: clampInt(pick("followUpSec"), 0, 120, 0),
      translateTo: pick("translateTo") === "en-US" ? "en-US" : "ru-RU",
      lectureEverySec: clampInt(pick("lectureEverySec"), 10, 60, DEFAULT_SETTINGS.lectureEverySec),
      talkEverySec: clampInt(pick("talkEverySec"), 0, 60, DEFAULT_SETTINGS.talkEverySec),
      talkGoal: String(pick("talkGoal") ?? "").trim().slice(0, 300),
      navMode: ["walking", "driving", "cycling"].includes(pick("navMode")) ? pick("navMode") : "walking",
      navMap: pick("navMap") !== false,
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
    loadMapAreas() {
      const a = this.read(MAP_AREAS_KEY);
      return Array.isArray(a) ? a.filter((x) => x && typeof x.id === "string" && Number.isFinite(x.lat) && Number.isFinite(x.lng)) : [];
    }
    saveMapAreas(a) {
      this.write(MAP_AREAS_KEY, a);
    }
    loadNav() {
      const t = this.read(NAV_KEY);
      const d = t?.dest;
      return t && d && typeof d.name === "string" && Number.isFinite(d.lat) && Number.isFinite(d.lng) && typeof t.startedAt === "number" ? t : null;
    }
    saveNav(t) {
      if (t)
        this.write(NAV_KEY, t);
      else {
        try {
          this.kv?.removeItem(NAV_KEY);
        } catch {}
      }
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
  var NAV_WAIT_MS = 9000;
  var NAV_TURN_MS = 4500;
  var NAV_BUSY_MS = 25000;
  var NAV_MSG_MS = 6000;
  var NAV_RESUME_MS = 3 * 3600000;

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
    ownerVoice = null;
    phraseWait = null;
    navWait = null;
    nav;
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
      this.nav = new Navigator({
        search: (q) => this.findPlace(q),
        start: (place, mode) => deps.nav ? deps.nav.start(place, mode) : Promise.resolve({ ok: false, error: "navigation adapter not configured" }),
        stop: () => deps.nav?.stop(),
        screen: (text, kind) => this.navScreen(text, kind),
        log: (kind, msg) => this.addLog(kind, msg),
        now: () => this.now(),
        setTimer: (fn, ms) => this.setTimer(fn, ms),
        clearTimer: (id) => this.clearTimerFn(id),
        onChange: () => this.changed(),
        save: (t) => deps.store.saveNav(t),
        ended: () => {
          if (this.phase === "idle" && this.clearTimer_ == null)
            this.clearDisplay();
        },
        mapOn: () => this.navMapOn(),
        roads: deps.nav?.roads ? (c, r, m) => deps.nav.roads(c, r, m) : undefined,
        prefetch: deps.nav?.prefetch ? (route) => deps.nav.prefetch(route) : undefined,
        watch: deps.nav?.watch ? (cb) => deps.nav.watch(cb) : undefined
      });
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
    navMapOn() {
      return this.settings.navMap && Boolean(this.deps.showBitmap);
    }
    glassesBitmap = false;
    lastBitmap = "";
    showBitmap(b64) {
      if (this.glassesBitmap && b64 === this.lastBitmap)
        return;
      try {
        this.deps.showBitmap?.(b64);
      } catch (e) {
        this.addLog("error", `Дисплей (картинка): ${String(e?.message ?? e)}`);
        return;
      }
      this.glassesBitmap = true;
      this.lastBitmap = b64;
      this.warnIfDashboard();
      this.changed();
    }
    showRoute() {
      if (this.navMapOn() && this.nav.frame)
        this.showBitmap(this.nav.frame);
      else if (this.nav.screen)
        this.show(fitScreen(this.nav.screen));
    }
    show(text) {
      if (this.glassesBitmap) {
        this.glassesBitmap = false;
        this.changed();
      }
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
      if (this.nav.active && (this.nav.screen || this.navMapOn() && this.nav.frame)) {
        this.showRoute();
        return;
      }
      this.glassesBitmap = false;
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
      const mapWas = this.navMapOn();
      this.settings = merged;
      this.deps.store.saveSettings(merged);
      this.addLog("info", "Настройки сохранены");
      if (mapWas !== this.navMapOn()) {
        this.nav.mapChanged();
        if (this.nav.active && this.phase === "idle" && this.clearTimer_ == null)
          this.clearDisplay();
      }
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
        else if (this.phase === "translating")
          this.translationScreen ? this.show(this.translationScreen) : this.clearDisplay();
      }, ms);
    }
    fromAnotherVoice(t, isFinal, speaker) {
      if (!speaker)
        return false;
      const wake = this.wake(t).matched;
      if (isFinal && wake && this.ownerVoice !== speaker) {
        this.ownerVoice = speaker;
        this.addLog("info", `Ваш голос — «голос ${speaker}»${this.settings.voiceLock ? ": команды без активатора теперь только от него" : ""}`);
        this.changed();
      }
      if (!this.settings.voiceLock || !this.ownerVoice || speaker === this.ownerVoice || wake)
        return false;
      if (this.phase === "talk") {
        if (isFinal)
          this.talk.onSpeech(t, "other");
        else
          this.talk.onInterim(t);
      } else if (this.phase === "lecture") {
        if (isFinal)
          this.lecture.onSpeech(t);
      } else if (isFinal && looksLikeCommand(t)) {
        this.addLog("info", `Команда чужим голосом пропущена: «${t}»`);
      }
      return true;
    }
    wakeWords() {
      return [...this.settings.wakeWords, ...AI_WAKE_WORDS];
    }
    wake(t) {
      return detectWake(t, this.wakeWords());
    }
    onTranscript(text, isFinal, speakerId) {
      if (this.settings.listenMode === "off")
        return;
      const t = String(text ?? "").trim();
      if (!t)
        return;
      const speaker = speakerId != null && String(speakerId).trim() ? String(speakerId).trim() : null;
      if (isFinal) {
        this.lastTranscript = t;
        this.addLog("stt", speaker ? `[голос ${speaker}] ${t}` : t);
      }
      if (this.fromAnotherVoice(t, isFinal, speaker))
        return;
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
          this.onTranscriptWhileTalk(t, speaker);
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
      const nav = this.navIntent(body);
      if (nav)
        return nav();
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
        const nav = this.committed.length === 0 ? this.navIntent(clean) : null;
        if (nav) {
          this.cancelTimer("silenceTimer");
          this.cancelTimer("wakeTimer");
          this.interim = "";
          this.phase = this.pages.length ? "answering" : "idle";
          nav();
          return;
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
      const nav = mine ? this.navIntent(body, !wake.matched) : null;
      if (nav)
        return nav();
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
    onTranscriptWhileTalk(t, speaker = null) {
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
      const nav = this.navIntent(body, !wake.matched);
      if (nav)
        return nav();
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
      const who = speaker && this.ownerVoice ? speaker === this.ownerVoice ? "me" : "other" : undefined;
      this.talk.onSpeech(t, who);
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
      const nav = this.navIntent(body, !wake.matched);
      if (nav)
        return nav();
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
        if (!up && this.phase === "idle" && this.nav.active && this.clearTimer_ == null) {
          this.lastBitmap = "";
          this.showRoute();
        }
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
    navIntent(body, strict = false) {
      const waiting = this.navWait && this.now() < this.navWait.until ? this.navWait : null;
      const c = parseNavCommand(body);
      if (c) {
        if (strict && !(c.kind === "stop" && (this.nav.active || this.nav.busy)))
          return null;
        switch (c.kind) {
          case "go":
            return () => {
              this.navWait = null;
              this.navigate(c.query, c.mode ?? this.settings.navMode, "voice");
            };
          case "stop":
            return () => {
              this.navWait = null;
              this.stopNav("voice");
            };
          case "status":
            return this.nav.active ? () => this.flash(this.nav.status(), 5000) : null;
          case "ask":
            return () => this.askDestination(c.mode);
        }
      }
      if (!waiting)
        return null;
      const cmd = parseCommand(body);
      if (cmd === "cancel" || cmd === "hide") {
        return () => {
          this.navWait = null;
          this.addLog("cmd", "Навигатор: отменено");
          this.flash("Маршрут отменён.", 1500);
        };
      }
      const place = body.replace(/[?？!.…]+$/u, "").replace(/^(?:до|к|ко|в|во|на|to)\s+/iu, "").trim();
      if (!normalize(place) || place.split(/\s+/).length > 10)
        return null;
      return () => {
        this.navWait = null;
        this.navigate(place, waiting.mode ?? this.settings.navMode, "voice");
      };
    }
    askDestination(mode) {
      if (!this.navAvailable())
        return;
      this.navWait = { mode, until: this.now() + NAV_WAIT_MS };
      this.addLog("cmd", "Навигатор: жду, куда");
      this.flash(`Навигатор${mode ? ", " + modeLabel(mode) : ""}: куда?
Скажите место или адрес`, NAV_WAIT_MS);
    }
    navProblem() {
      if (!this.deps.nav)
        return "Навигация недоступна в этой версии Mentra";
      try {
        return this.deps.nav.problem?.() ?? "";
      } catch {
        return "";
      }
    }
    navAvailable() {
      const problem = this.navProblem();
      if (!problem)
        return true;
      this.addLog("error", `Навигатор: ${problem}`);
      this.flash(`${problem}.`, 6000);
      return false;
    }
    async navigate(query, mode, source) {
      const q = String(query ?? "").trim();
      if (!q || !this.navAvailable())
        return;
      this.addLog("cmd", `Навигатор: «${q}», ${modeLabel(mode)} (${source === "ui" ? "с телефона" : "голосом"})`);
      await this.nav.go(q, mode);
    }
    async navigateTo(place, mode) {
      if (!this.navAvailable())
        return;
      this.addLog("cmd", `Навигатор: ${place.name}, ${modeLabel(mode)} (с телефона)`);
      await this.nav.goTo(place, mode);
    }
    stopNav(source) {
      if (!this.nav.active && !this.nav.busy) {
        if (source === "voice")
          this.flash("Маршрута нет.", 2000);
        return;
      }
      const wasActive = this.nav.active;
      this.nav.stop(source);
      if (source === "voice")
        this.flash(wasActive ? "Маршрут завершён." : "Поиск маршрута отменён.", 2000);
      else if (!wasActive && this.phase === "idle") {
        this.cancelTimer("clearTimer_");
        this.clearDisplay();
      }
    }
    async resumeNav(trip, hostActive) {
      if (!trip)
        return;
      if (!hostActive || this.now() - trip.startedAt > NAV_RESUME_MS || !this.deps.nav) {
        this.deps.store.saveNav(null);
        return;
      }
      await this.nav.resume(trip);
    }
    navScreen(text, kind) {
      if (kind === "message")
        this.flash(text, this.nav.busy ? NAV_BUSY_MS : NAV_MSG_MS);
      else if (this.phase === "idle" && this.clearTimer_ == null) {
        if (this.navMapOn() && this.nav.frame)
          this.showBitmap(this.nav.frame);
        else
          this.show(fitScreen(text));
      } else if (kind === "turn")
        this.flash(text, NAV_TURN_MS);
    }
    testBitmap(b64) {
      if (!this.deps.showBitmap)
        return false;
      this.cancelTimer("clearTimer_");
      this.lastBitmap = "";
      this.showBitmap(b64);
      this.addLog("display", "Проверка картинки на очках");
      this.clearTimer_ = this.setTimer(() => {
        this.clearTimer_ = null;
        if (this.phase === "idle")
          this.clearDisplay();
        else if (this.phase === "answering")
          this.showPage(this.page);
      }, 8000);
      return true;
    }
    async locate() {
      try {
        return await this.deps.nav?.locate() ?? null;
      } catch (e) {
        this.addLog("info", `Геопозиция: ${explainNavError(e?.message ?? e)} — ищу без неё`);
        return null;
      }
    }
    async mapQueries(query, near) {
      const queries = [];
      const provider = asProvider(this.settings.provider);
      if (/[а-яё]/iu.test(query) && keyFor(this.settings, provider)) {
        try {
          const { system, user } = buildMapQueryPrompt(query, near);
          const q = cleanMapQuery(await this.completeOnce(system, user));
          if (q) {
            queries.push(q);
            if (normalize(q) !== normalize(query))
              this.addLog("nav", `Ищу на карте: ${q}`);
          }
        } catch (e) {
          const err = e;
          this.addLog("error", `Не удалось уточнить место: ${explainLLMError(err?.provider ?? provider, Number(err?.status) || 0, String(err?.code ?? ""), String(err?.message ?? ""))}`);
        }
      }
      if (!queries.includes(query))
        queries.push(query);
      return queries;
    }
    async findPlace(query) {
      const host = this.deps.nav;
      if (!host)
        return null;
      const near = await this.locate();
      for (const q of await this.mapQueries(query, near)) {
        const found = await host.suggest(q, near);
        for (const sug of found.slice(0, 3)) {
          const place = await this.placeFor(sug);
          if (place) {
            this.addLog("nav", `Найдено: ${place.name}${place.address ? ", " + place.address : ""}`);
            return place;
          }
        }
      }
      return null;
    }
    async placeFor(sug) {
      let place = null;
      try {
        place = await this.deps.nav?.details(sug.placeId) ?? null;
      } catch {
        place = null;
      }
      if (!place || !Number.isFinite(place.lat) || !Number.isFinite(place.lng))
        return null;
      return { ...place, name: place.name || sug.mainText, address: place.address || sug.secondaryText };
    }
    async searchPlaces(query) {
      const host = this.deps.nav;
      const q = String(query ?? "").trim();
      if (!host || !q)
        return [];
      const near = await this.locate();
      const seen = new Set;
      const out = [];
      for (const mq of await this.mapQueries(q, near)) {
        for (const sug of await host.suggest(mq, near)) {
          if (seen.has(sug.placeId))
            continue;
          seen.add(sug.placeId);
          out.push(sug);
        }
        if (out.length >= 5)
          break;
      }
      return out.slice(0, 8);
    }
    snapshot() {
      const hint = (k) => k ? `${k.slice(0, k.startsWith("sk-ant-") ? 7 : 3)}…${k.slice(-4)}` : "";
      const provider = asProvider(this.settings.provider);
      const key = keyFor(this.settings, provider);
      return {
        phase: this.phase,
        page: this.page,
        pages: this.pages.length,
        currentScreen: this.phase === "translating" ? this.translationScreen : this.phase === "lecture" ? this.lecture.screen : this.phase === "talk" ? this.talk.screen : this.phase === "idle" && this.nav.active ? this.nav.screen : this.pages[this.page] ?? "",
        translating: this.phase === "translating",
        glassesBitmap: this.glassesBitmap,
        lastTranscript: this.lastTranscript,
        lastQuestion: this.lastQuestion,
        lastAnswer: this.lastAnswer,
        lastError: this.lastError,
        dashboardLikely: this.dashboardLikely(),
        ownerVoice: this.ownerVoice,
        lecture: lectureSnapshot(this.lecture.active, this.lecture.record),
        talk: lectureSnapshot(this.talk.active, this.talk.record),
        nav: {
          problem: this.navProblem(),
          active: this.nav.active,
          busy: this.nav.busy,
          dest: this.nav.dest,
          mode: this.nav.mode,
          screen: this.nav.screen,
          message: this.nav.message,
          left: this.nav.left(),
          map: this.navMapOn(),
          canMap: Boolean(this.deps.showBitmap),
          frameId: this.nav.frameId,
          streets: this.nav.roads.length
        },
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
  function looksLikeCommand(t) {
    return Boolean(parseCommand(t) || parseTranslateCommand(t) || parseLectureCommand(t) || parseTalkCommand(t) || parsePhraseRequest(t) || parseSwitchCommand(t));
  }

  // src/background/tiles.ts
  var TILEJSON_URL = "https://tiles.openfreemap.org/planet";
  var FALLBACK_TEMPLATE = "https://tiles.openfreemap.org/planet/latest/{z}/{x}/{y}.pbf";
  var OVERVIEW_ZOOM = 12;
  var AVG_TILE_KB = 160;
  var GLASSES_LAYERS = new Set(["transportation", "water", "waterway", "park", "landcover"]);
  var DECODED_MAX = 16;
  var PARALLEL = 3;
  var key = (z, x, y) => `map/${z}/${x}/${y}`;
  function classify(layer, f) {
    const cls = String(f.props.class ?? "");
    switch (layer) {
      case "transportation": {
        if (f.props.brunnel === "tunnel" || cls.endsWith("_construction"))
          return null;
        if (cls === "motorway" || cls === "trunk" || cls === "primary")
          return "major";
        if (cls === "secondary" || cls === "tertiary")
          return "road";
        if (cls === "minor" || cls === "service" || cls === "track" || cls === "busway" || cls === "raceway")
          return "minor";
        if (cls === "path")
          return f.props.subclass === "platform" ? null : "path";
        if (cls === "rail" || cls === "transit")
          return "rail";
        return null;
      }
      case "water":
        return cls === "swimming_pool" ? null : "water";
      case "waterway":
        return cls === "river" || cls === "canal" || cls === "stream" ? "waterway" : null;
      case "park":
        return "park";
      case "landcover":
        return cls === "wood" || cls === "grass" ? "park" : null;
      case "building":
        return "building";
    }
    return null;
  }
  function ringArea(r) {
    let a = 0;
    for (let i = 0;i + 3 < r.length; i += 2)
      a += r[i] * r[i + 3] - r[i + 2] * r[i + 1];
    return Math.abs(a / 2);
  }
  function tileFeatures(bytes, z, x, y) {
    const tile = decodeTile(bytes, { layers: GLASSES_LAYERS, props: new Set(["class", "subclass", "brunnel"]) });
    const n = 2 ** z;
    const out = [];
    for (const [name, layer] of Object.entries(tile)) {
      const s = 1 / (layer.extent * n);
      const ox = x / n;
      const oy = y / n;
      for (const f of layer.features) {
        const k = classify(name, f);
        if (!k)
          continue;
        const poly = f.type === 3;
        if (k === "park" && poly && f.geom.reduce((a, r) => a + ringArea(r), 0) < 6000)
          continue;
        let bx0 = Infinity;
        let by0 = Infinity;
        let bx1 = -Infinity;
        let by1 = -Infinity;
        const p = f.geom.map((r) => {
          const w = new Array(r.length);
          for (let i = 0;i < r.length; i += 2) {
            const wx = ox + r[i] * s;
            const wy = oy + r[i + 1] * s;
            w[i] = wx;
            w[i + 1] = wy;
            if (wx < bx0)
              bx0 = wx;
            if (wx > bx1)
              bx1 = wx;
            if (wy < by0)
              by0 = wy;
            if (wy > by1)
              by1 = wy;
          }
          return w;
        });
        if (p.length && Number.isFinite(bx0))
          out.push({ k, poly, p, b: [bx0, by0, bx1, by1] });
      }
    }
    return out;
  }
  function placeName(bytes, z, x, y, lat, lng) {
    const tile = decodeTile(bytes, { layers: new Set(["place"]), props: new Set(["class", "name", "name:latin"]) });
    const layer = tile.place;
    if (!layer)
      return "";
    const rank = { city: 0, town: 1, village: 2, suburb: 3, quarter: 4, neighbourhood: 5, hamlet: 6 };
    const w = toWorld(lat, lng);
    const n = 2 ** z;
    let best = null;
    for (const f of layer.features) {
      const name = String(f.props.name ?? f.props["name:latin"] ?? "").trim();
      const r = rank[String(f.props.class ?? "")];
      if (!name || r === undefined || !f.geom[0])
        continue;
      const fx = (x + f.geom[0][0] / layer.extent) / n;
      const fy = (y + f.geom[0][1] / layer.extent) / n;
      const d = Math.hypot(fx - w.x, fy - w.y) * metersPerWorld(lat);
      const score = r * 1500 + d;
      if (!best || score < best.score)
        best = { name, score };
    }
    return best?.name ?? "";
  }

  class TileStore {
    deps;
    index = new Map;
    indexReady = null;
    template = null;
    templateAt = 0;
    inflight = new Map;
    decoded = new Map;
    failedAt = new Map;
    download = null;
    cancelled = false;
    areas;
    constructor(deps) {
      this.deps = deps;
      this.areas = deps.loadAreas();
    }
    get available() {
      return Boolean(this.deps.blob);
    }
    stats() {
      let bytes = 0;
      for (const b of this.index.values())
        bytes += b;
      return { tiles: this.index.size, bytes };
    }
    ready() {
      if (!this.indexReady) {
        this.indexReady = (async () => {
          if (!this.deps.blob)
            return;
          try {
            for (const b of await this.deps.blob.list())
              if (b.key.startsWith("map/"))
                this.index.set(b.key, b.bytes);
          } catch (e) {
            this.deps.log("info", `Офлайн-карты: список не прочитан (${String(e?.message ?? e)})`);
          }
          this.deps.onChange();
        })();
      }
      return this.indexReady;
    }
    has(z, x, y) {
      return this.index.has(key(z, x, y));
    }
    async tileUrl(z, x, y) {
      if (!this.template || this.deps.now() - this.templateAt > 6 * 3600000) {
        try {
          const tj = await this.deps.fetchJson(TILEJSON_URL);
          const t = Array.isArray(tj?.tiles) ? String(tj.tiles[0] ?? "") : "";
          if (/\{z\}.*\{x\}.*\{y\}/.test(t)) {
            this.template = t;
            this.templateAt = this.deps.now();
          }
        } catch {}
      }
      return (this.template ?? FALLBACK_TEMPLATE).replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
    }
    ensure(z, x, y) {
      const k = key(z, x, y);
      if (this.index.has(k))
        return Promise.resolve(true);
      const blob = this.deps.blob;
      if (!blob)
        return Promise.resolve(false);
      const failed = this.failedAt.get(k);
      if (failed && this.deps.now() - failed < 60000)
        return Promise.resolve(false);
      let p = this.inflight.get(k);
      if (!p) {
        p = (async () => {
          try {
            await this.ready();
            if (this.index.has(k))
              return true;
            const meta = await blob.setFromUrl(k, await this.tileUrl(z, x, y), { mimeType: "application/x-protobuf" });
            this.index.set(k, Number(meta?.bytes) || 0);
            this.failedAt.delete(k);
            return true;
          } catch {
            this.failedAt.set(k, this.deps.now());
            return false;
          } finally {
            this.inflight.delete(k);
          }
        })();
        this.inflight.set(k, p);
      }
      return p;
    }
    async raw(z, x, y, fetch2 = true) {
      await this.ready();
      if (!this.has(z, x, y) && !(fetch2 && await this.ensure(z, x, y)))
        return null;
      try {
        return await this.deps.blob?.bytes(key(z, x, y)) ?? null;
      } catch {
        return null;
      }
    }
    async features(center, radiusM) {
      await this.ready();
      const tiles = tilesAround(center.lat, center.lng, radiusM);
      const w = toWorld(center.lat, center.lng);
      const r = radiusM / metersPerWorld(center.lat);
      const box = [w.x - r, w.y - r, w.x + r, w.y + r];
      const out = [];
      let missing = 0;
      for (const t of tiles) {
        const k = key(TILE_ZOOM, t.x, t.y);
        let feats = this.decoded.get(k);
        if (!feats) {
          const bytes = await this.raw(TILE_ZOOM, t.x, t.y);
          if (!bytes) {
            missing++;
            continue;
          }
          try {
            feats = tileFeatures(bytes, TILE_ZOOM, t.x, t.y);
          } catch (e) {
            this.deps.log("error", `Карта: участок ${t.x}/${t.y} не прочитан (${String(e?.message ?? e)})`);
            missing++;
            continue;
          }
          this.decoded.set(k, feats);
          if (this.decoded.size > DECODED_MAX)
            this.decoded.delete(this.decoded.keys().next().value);
        }
        for (const f of feats)
          if (f.b[2] >= box[0] && f.b[0] <= box[2] && f.b[3] >= box[1] && f.b[1] <= box[3])
            out.push(f);
      }
      if (missing === tiles.length)
        throw new Error("нет карты этого места (нет интернета и не скачана заранее)");
      return out;
    }
    async prefetchRoute(points) {
      if (!this.deps.blob || points.length < 2)
        return 0;
      await this.ready();
      const want = new Set;
      const add = (p) => {
        for (const t of tilesAround(p.lat, p.lng, 300))
          want.add(`${t.x}/${t.y}`);
      };
      add(points[0]);
      for (let i = 1;i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        const steps = Math.ceil(Math.hypot(b.lat - a.lat, b.lng - a.lng) * 111000 / 400);
        for (let s = 1;s <= steps; s++)
          add({ lat: a.lat + (b.lat - a.lat) * s / steps, lng: a.lng + (b.lng - a.lng) * s / steps });
      }
      const list = [...want].map((s) => s.split("/").map(Number)).filter(([x, y]) => !this.has(TILE_ZOOM, x, y));
      let got = 0;
      for (let i = 0;i < list.length; i += PARALLEL) {
        const r = await Promise.all(list.slice(i, i + PARALLEL).map(([x, y]) => this.ensure(TILE_ZOOM, x, y)));
        got += r.filter(Boolean).length;
      }
      if (got) {
        this.deps.log("nav", `Карта маршрута сохранена на телефоне: ${got} участк.`);
        this.deps.onChange();
      }
      return got;
    }
    areaTiles(lat, lng, radiusKm) {
      const m = radiusKm * 1000;
      return [
        ...tilesAround(lat, lng, m, OVERVIEW_ZOOM).map((t) => ({ z: OVERVIEW_ZOOM, ...t })),
        ...tilesAround(lat, lng, m).map((t) => ({ z: TILE_ZOOM, ...t }))
      ];
    }
    estimateMb(lat, lng, radiusKm) {
      const n = this.areaTiles(lat, lng, radiusKm).filter((t) => !this.has(t.z, t.x, t.y)).length;
      return Math.max(1, Math.round(n * AVG_TILE_KB / 1024));
    }
    async downloadArea(lat, lng, radiusKm) {
      if (!this.deps.blob || this.download)
        return null;
      const tiles = this.areaTiles(lat, lng, radiusKm);
      const id = `a${this.deps.now().toString(36)}`;
      this.cancelled = false;
      this.download = { areaId: id, name: "", radiusKm, done: 0, total: tiles.length, failed: 0, bytes: 0 };
      await this.ready();
      this.deps.log("nav", `Офлайн-карта: скачиваю ${tiles.length} участков вокруг (${radiusKm} км)`);
      this.deps.onChange();
      const c = tileOf(lat, lng);
      tiles.sort((a, b) => a.z === TILE_ZOOM && a.x === c.x && a.y === c.y ? -1 : b.z === TILE_ZOOM && b.x === c.x && b.y === c.y ? 1 : 0);
      let lastPush = 0;
      for (let i = 0;i < tiles.length && !this.cancelled; i += PARALLEL) {
        const batch = tiles.slice(i, i + PARALLEL);
        const ok = await Promise.all(batch.map((t) => this.ensure(t.z, t.x, t.y)));
        const d = this.download;
        if (!d)
          break;
        d.done += batch.length;
        d.failed += ok.filter((v) => !v).length;
        d.bytes = batch.reduce((a, t) => a + (this.index.get(key(t.z, t.x, t.y)) ?? 0), d.bytes);
        if (d.failed >= 9 && d.failed === d.done)
          break;
        if (this.deps.now() - lastPush > 700) {
          lastPush = this.deps.now();
          this.deps.onChange();
        }
      }
      const d = this.download;
      this.download = null;
      if (this.cancelled || d.failed === d.done) {
        this.deps.log(d.failed === d.done ? "error" : "nav", d.failed === d.done ? "Офлайн-карта не скачалась: нет связи с сервером карт" : "Скачивание карты остановлено");
        this.deps.onChange();
        return null;
      }
      let name = "";
      try {
        const bytes = await this.raw(TILE_ZOOM, c.x, c.y, false);
        if (bytes)
          name = placeName(bytes, TILE_ZOOM, c.x, c.y, lat, lng);
      } catch {}
      const area = {
        id,
        name: name || `${lat.toFixed(3)}, ${lng.toFixed(3)}`,
        lat,
        lng,
        radiusKm,
        tiles: d.done - d.failed,
        bytes: tiles.reduce((a, t) => a + (this.index.get(key(t.z, t.x, t.y)) ?? 0), 0),
        at: this.deps.now()
      };
      this.areas = [area, ...this.areas];
      this.deps.saveAreas(this.areas);
      this.deps.log("nav", `Офлайн-карта «${area.name}» скачана: ${area.tiles} участков, ${(area.bytes / 1048576).toFixed(1)} МБ${d.failed ? `, не скачалось ${d.failed}` : ""}`);
      this.deps.onChange();
      return area;
    }
    cancelDownload() {
      this.cancelled = true;
    }
    async deleteArea(id) {
      const area = this.areas.find((a) => a.id === id);
      if (!area || !this.deps.blob)
        return;
      const keep = new Set;
      for (const o of this.areas)
        if (o.id !== id)
          for (const t of this.areaTiles(o.lat, o.lng, o.radiusKm))
            keep.add(key(t.z, t.x, t.y));
      for (const t of this.areaTiles(area.lat, area.lng, area.radiusKm)) {
        const k = key(t.z, t.x, t.y);
        if (keep.has(k) || !this.index.has(k))
          continue;
        try {
          await this.deps.blob.delete(k);
          this.index.delete(k);
          this.decoded.delete(k);
        } catch {}
      }
      this.areas = this.areas.filter((a) => a.id !== id);
      this.deps.saveAreas(this.areas);
      this.deps.log("nav", `Офлайн-карта «${area.name}» удалена`);
      this.deps.onChange();
    }
    async deleteAll() {
      if (!this.deps.blob)
        return;
      await this.ready();
      for (const k of [...this.index.keys()]) {
        try {
          await this.deps.blob.delete(k);
          this.index.delete(k);
        } catch {}
      }
      this.decoded.clear();
      this.areas = [];
      this.deps.saveAreas(this.areas);
      this.deps.log("nav", "Все карты удалены с телефона");
      this.deps.onChange();
    }
  }

  // src/background/index.ts
  var APP_VERSION = "1.15.0";
  function newToken() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      return (c === "x" ? r : r & 3 | 8).toString(16);
    });
  }
  var asMode = (m) => m === "driving" || m === "cycling" ? m : "walking";
  function withTimeout2(p, ms, what) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`${what}: timeout`)), ms);
      p.then((v) => {
        clearTimeout(t);
        resolve(v);
      }, (e) => {
        clearTimeout(t);
        reject(e);
      });
    });
  }
  function makeNavHost(session, log, tiles) {
    const nav = session.navigation;
    if (!nav || typeof nav.start !== "function")
      return;
    let token = newToken();
    let termsAsked = false;
    let lastFix = null;
    return {
      problem: () => nav.hasPermission === false ? "нет разрешения на геопозицию — загрузите EVA-IA заново: Mentra → Settings → Miniapp Developer Settings → Load Miniapp from URL" : "",
      async locate() {
        if (lastFix && Date.now() - lastFix.at < 60000)
          return { lat: lastFix.lat, lng: lastFix.lng };
        const fix = await session.location.getOnce();
        const lat = Number(fix?.lat);
        const lng = Number(fix?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng))
          return null;
        lastFix = { lat, lng, at: Date.now() };
        return { lat, lng };
      },
      async suggest(query, near) {
        token = newToken();
        const r = await nav.placeAutocomplete({ query, near: near ?? undefined, sessionToken: token });
        if (!r?.ok)
          throw new Error(r?.error || "place search failed");
        return (r.suggestions ?? []).filter((x) => x?.placeId);
      },
      async details(placeId) {
        const r = await nav.placeDetails({ placeId, sessionToken: token });
        if (!r?.ok || !r.place)
          return null;
        const p = r.place;
        return { name: String(p.name ?? ""), address: String(p.address ?? ""), lat: Number(p.lat), lng: Number(p.lng) };
      },
      async start(place, mode) {
        if (!termsAsked) {
          termsAsked = true;
          try {
            const pr = await nav.requestPermission();
            if (pr && pr.ok && pr.accepted === false) {
              termsAsked = false;
              return { ok: false, error: "terms not accepted" };
            }
            if (pr && !pr.ok && pr.error)
              log(`Навигация: ${pr.error}`);
          } catch (e) {
            log(`Навигация: условия не запрошены (${String(e?.message ?? e)})`);
          }
        }
        return nav.start({ lat: place.lat, lng: place.lng, mode });
      },
      stop() {
        nav.stop();
      },
      roads: (center, radius) => tiles.features(center, radius),
      prefetch: (route) => void tiles.prefetchRoute(route),
      watch(onPosition) {
        const off = session.location?.onUpdate?.((p) => onPosition({ lat: Number(p?.lat), lng: Number(p?.lng), accuracy: p?.accuracy }));
        return () => {
          try {
            off?.();
          } catch {}
        };
      }
    };
  }
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
    const snap = () => ({ ...assistant.snapshot(), version: APP_VERSION, maps: mapsState() });
    const blob = session.blob;
    const tiles = new TileStore({
      blob: blob && typeof blob.setFromUrl === "function" ? {
        setFromUrl: (k, url, o) => withTimeout2(blob.setFromUrl(k, url, o), 60000, "map download"),
        bytes: (k) => blob.bytes(k),
        list: () => blob.list(),
        delete: (k) => blob.delete(k)
      } : null,
      fetchJson: async (url) => {
        const res = await withTimeout2(globalThis.fetch(url), 15000, "TileJSON");
        if (!res?.ok)
          throw new Error(`HTTP ${res?.status}`);
        return JSON.parse(await res.text());
      },
      log: (kind, msg) => assistant.addLog(kind, msg),
      now: () => Date.now(),
      onChange: () => pushState(),
      loadAreas: () => store.loadMapAreas(),
      saveAreas: (a) => store.saveMapAreas(a)
    });
    const mapsState = () => ({
      available: tiles.available,
      ...tiles.stats(),
      download: tiles.download,
      areas: tiles.areas
    });
    const assistant = new Assistant({
      store,
      fetch: (url, init) => globalThis.fetch(url, init),
      show: (text) => session.display.render([{ type: "text", id: "g1gpt", box: fullBox(), text, style: { breakMode: "word" } }]),
      clear: () => {
        session.display.render([])?.catch?.(() => {});
      },
      startTranslation: (target, handler) => session.translation.to(target, handler),
      showBitmap: (data) => {
        session.sendRequest({ type: "miniapp_display", view: "main", layout: { layoutType: "bitmap_view", data } })?.catch?.((e) => assistant.addLog("error", `Картинка на очках: ${String(e?.message ?? e)}`));
      },
      onChange: pushState,
      nav: makeNavHost(session, (msg) => assistant.addLog("info", msg), tiles)
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
      try {
        session.transcription.configure({
          languageHints: s.sttLanguage === "auto" ? ["ru", "en"] : ["ru"],
          vocabulary: s.wakeWords.slice(0, 10)
        })?.catch?.(() => {});
      } catch (e) {
        assistant.addLog("info", `configure STT пропущен: ${String(e?.message ?? e)}`);
      }
      const handler = (data) => assistant.onTranscript(data?.text ?? "", Boolean(data?.isFinal), data?.speakerId);
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
        if (session.transcription?.hasPermission === false)
          assistant.addLog("error", "Нет разрешения MICROPHONE в манифесте");
        const navProblem = assistant.navProblem();
        if (navProblem)
          assistant.addLog("info", `Навигатор: ${navProblem}`);
      });
    } catch {}
    try {
      if (session.navigation) {
        session.navigation.onUpdate((u) => assistant.nav.onUpdate(u));
        session.navigation.onRoute?.((r) => assistant.nav.onRoute(r?.points ?? []));
        const saved = store.loadNav();
        if (saved) {
          session.navigation.getState().then((st) => assistant.resumeNav(saved, Boolean(st?.active))).catch(() => assistant.resumeNav(saved, false));
        }
      }
    } catch (e) {
      assistant.addLog("info", `Навигатор не подключён: ${String(e?.message ?? e)}`);
    }
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
    session.ui.handle("navSearch", async (p) => {
      try {
        return { ok: true, results: await assistant.searchPlaces(String(p?.query ?? "")) };
      } catch (e) {
        const msg = String(e?.message ?? e);
        assistant.addLog("error", `Поиск места: ${msg}`);
        return { ok: false, error: msg };
      }
    });
    session.ui.handle("navGo", async (p) => {
      const mode = asMode(p?.mode);
      if (p?.placeId) {
        const place = await assistant.placeFor({
          placeId: String(p.placeId),
          mainText: String(p.mainText ?? ""),
          secondaryText: String(p.secondaryText ?? "")
        });
        if (!place) {
          assistant.addLog("error", "Навигатор: Mentra не нашла координаты этого места");
          return { ...snap(), navError: "Не удалось получить координаты этого места" };
        }
        assistant.navigateTo(place, mode);
      } else
        assistant.navigate(String(p?.query ?? ""), mode, "ui");
      return snap();
    });
    session.ui.handle("navStop", () => {
      assistant.stopNav("ui");
      return snap();
    });
    session.ui.handle("navFrame", () => ({ frame: assistant.nav.frame, frameId: assistant.nav.frameId }));
    session.ui.handle("navMap", (p) => {
      const n = assistant.nav;
      const round = (q) => [Math.round(q.lat * 1e6) / 1e6, Math.round(q.lng * 1e6) / 1e6];
      return {
        active: n.active,
        mode: n.mode,
        me: n.me ? round(n.me) : null,
        heading: n.heading,
        dest: n.dest ? round(n.dest) : null,
        route: n.route.map(round)
      };
    });
    session.ui.handle("mapTile", async (p) => {
      const z = Math.round(Number(p?.z));
      const x = Math.round(Number(p?.x));
      const y = Math.round(Number(p?.y));
      if (![z, x, y].every(Number.isFinite))
        return { ok: false };
      const bytes = await tiles.raw(z, x, y, p?.fetch !== false);
      return bytes ? { ok: true, b64: toBase64(bytes) } : { ok: false };
    });
    session.ui.handle("mapLocate", async () => {
      try {
        const fix = await withTimeout2(session.location.getOnce(), 15000, "location");
        return Number.isFinite(fix?.lat) ? { ok: true, lat: fix.lat, lng: fix.lng } : { ok: false };
      } catch (e) {
        return { ok: false, error: String(e?.message ?? e) };
      }
    });
    session.ui.handle("mapEstimate", (p) => {
      const lat = Number(p?.lat);
      const lng = Number(p?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng))
        return {};
      return { 2: tiles.estimateMb(lat, lng, 2), 5: tiles.estimateMb(lat, lng, 5), 15: tiles.estimateMb(lat, lng, 15) };
    });
    session.ui.handle("mapDownload", (p) => {
      const lat = Number(p?.lat);
      const lng = Number(p?.lng);
      const r = [2, 5, 15].includes(Number(p?.radiusKm)) ? Number(p.radiusKm) : 5;
      if (!Number.isFinite(lat) || !Number.isFinite(lng))
        return { ok: false };
      tiles.downloadArea(lat, lng, r);
      return { ok: true };
    });
    session.ui.handle("mapCancel", () => {
      tiles.cancelDownload();
      return { ok: true };
    });
    session.ui.handle("mapDelete", async (p) => {
      if (p?.all)
        await tiles.deleteAll();
      else if (p?.id)
        await tiles.deleteArea(String(p.id));
      return snap();
    });
    session.ui.handle("navTestBitmap", () => ({ ok: assistant.testBitmap(testPattern()) }));
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
