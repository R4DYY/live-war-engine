import { create } from "zustand";
import type {
  NormalizedLiveEvent,
  LiveConnectionStatus,
  TeamSide,
  GiftSlot,
  SimulatorMetrics,
  GeneratedViewer,
  ReplayRecording,
  LiveEventSource,
} from "@/live/types";
import { simulatorAdapter } from "@/live/simulatorAdapter";
import { tiktokAdapter } from "@/live/tiktokAdapter";
import { tiktokBridgeClient, type TikTokBridgeState, type BridgeState } from "@/live/tiktokBridgeClient";
import { liveEventBus } from "@/live/liveEventBus";
import { liveService } from "@/live/liveService";
import { replayRecording } from "@/live/replay";
import { startGiftBridge, stopGiftBridge, getGiftBridgeStats } from "@/live/giftBridge";
import { chestManager } from "@/engine/chestManager";

const MAX_DISPLAY_EVENTS = 500;

const GIFT_SLOTS: GiftSlot[] = [
  { tier: "T1", role: "BASIC", simulatorGiftId: "sim_t1", simulatorGiftName: "Sim T1 Basic", targetPriceEuro: 0.01 },
  { tier: "T2", role: "SPECIALIST", simulatorGiftId: "sim_t2", simulatorGiftName: "Sim T2 Specialist", targetPriceEuro: 0.10 },
  { tier: "T3", role: "HEALER", simulatorGiftId: "sim_t3", simulatorGiftName: "Sim T3 Healer", targetPriceEuro: 0.50 },
  { tier: "T4", role: "BREAKER", simulatorGiftId: "sim_t4", simulatorGiftName: "Sim T4 Breaker", targetPriceEuro: 2 },
  { tier: "T5", role: "BOSS", simulatorGiftId: "sim_t5", simulatorGiftName: "Sim T5 Boss", targetPriceEuro: 5 },
  { tier: "T6", role: "ULTIMATE", simulatorGiftId: "sim_t6", simulatorGiftName: "Sim T6 Ultimate", targetPriceEuro: 20 },
];

interface LiveStore {
  status: LiveConnectionStatus;
  source: LiveEventSource;
  tiktok: TikTokBridgeState;
  bridge: BridgeState;
  eventStream: NormalizedLiveEvent[];
  selectedEvent: NormalizedLiveEvent | null;
  metrics: SimulatorMetrics;
  recording: boolean;
  recordedCount: number;
  lastRecording: ReplayRecording | null;
  replaying: boolean;
  replaySpeed: number;

  // Viewer
  username: string;
  userId: string;
  team: TeamSide;
  generatedViewers: GeneratedViewer[];

  // Gift
  giftSlots: GiftSlot[];
  giftQuantity: number;
  customQuantity: string;
  comboActive: boolean;
  comboId: string | null;
  comboCount: number;

  // Likes
  likesPerSecActive: boolean;
  likesPerSec: number;

  // Comments
  commentText: string;

  // Advanced raw gift
  rawGiftId: string;
  rawGiftName: string;
  rawGiftRepeat: number;

  // Network
  latencyMs: number;

  // Scenarios
  scenarioRunning: boolean;

  // Gift bridge
  giftBridgeActive: boolean;
  giftsProcessed: number;
  unitsSpawned: number;

  // Crowd simulation
  crowdActive: boolean;
  crowdIntensity: number;

  // Actions
  init: () => void;
  setSource: (source: LiveEventSource) => void;
  connectTikTok: (username: string) => void;
  disconnectTikTok: () => void;
  reconnectTikTok: () => void;
  setUsername: (v: string) => void;
  setUserId: (v: string) => void;
  setTeam: (t: TeamSide) => void;
  setGiftQuantity: (n: number) => void;
  setCustomQuantity: (v: string) => void;
  setCommentText: (v: string) => void;
  setRawGiftId: (v: string) => void;
  setRawGiftName: (v: string) => void;
  setRawGiftRepeat: (n: number) => void;
  setReplaySpeed: (s: number) => void;
  setLatency: (ms: number) => void;
  selectEvent: (e: NormalizedLiveEvent | null) => void;

  applyUserToAdapter: () => void;

  sendLike: (count: number) => void;
  sendComment: (text?: string) => void;
  sendGiftByTier: (tier: string) => void;
  sendRawGift: () => void;
  sendFollow: () => void;
  sendShare: () => void;
  sendJoin: () => void;
  sendLeave: () => void;

  startCombo: () => void;
  addComboRepeat: (n: number) => void;
  finishCombo: () => void;

  startLikesPerSec: (cps: number) => void;
  stopLikesPerSec: () => void;

  generateViewers: (count: number) => void;
  selectViewer: (v: GeneratedViewer) => void;
  selectPreset: (n: number) => void;
  selectRandomViewer: () => void;

  runScenario: (name: string) => void;
  runRealisticLive: (durationSec: number, viewers: number, likesPerSec: number, commentsPerMin: number, giftFreqSec: number) => void;
  runChaos: (durationSec: number) => void;

  startCrowdSimulation: () => void;
  stopCrowdSimulation: () => void;
  setCrowdIntensity: (level: number) => void;

  toggleGiftBridge: () => void;

  // Chest
  sendChestContribution: (team: "A" | "B", points: number) => void;
  setChestProgress: (percent: number) => void;
  forceUnlockChest: () => void;
  resetChest: () => void;

  simulateDisconnect: () => void;
  simulateReconnect: () => void;
  simulateError: () => void;
  dropNextEvent: () => void;
  duplicateLastEvent: () => void;
  sendMalformed: (kind: string) => void;

  startRecording: () => void;
  stopRecording: () => void;
  replay: () => void;
  clearEventLog: () => void;
  resetSimulator: () => void;
  resetViewers: () => void;
  stopAllScenarios: () => void;
}

function makeUser(userId: string, username: string): GeneratedViewer {
  const teams: TeamSide[] = ["A", "B"];
  return {
    userId,
    username,
    team: teams[Math.floor(Math.random() * 2)],
  };
}

function randomViewer(): GeneratedViewer {
  const id = crypto.randomUUID().slice(0, 8);
  return makeUser(`user-${id}`, `viewer_${id}`);
}

export const useLiveStore = create<LiveStore>((set, get) => {
  let replayCancel: (() => void) | null = null;
  let initialized = false;
  let likesInterval: ReturnType<typeof setInterval> | null = null;
  let scenarioTimers: ReturnType<typeof setTimeout>[] = [];
  let chaosInterval: ReturnType<typeof setInterval> | null = null;
  let crowdInterval: ReturnType<typeof setInterval> | null = null;

  function clearScenarioTimers(): void {
    for (const t of scenarioTimers) clearTimeout(t);
    scenarioTimers = [];
    if (chaosInterval) {
      clearInterval(chaosInterval);
      chaosInterval = null;
    }
    if (likesInterval) {
      clearInterval(likesInterval);
      likesInterval = null;
    }
    if (crowdInterval) {
      clearInterval(crowdInterval);
      crowdInterval = null;
    }
    set({ scenarioRunning: false, likesPerSecActive: false, crowdActive: false });
  }

  return {
    status: "DISCONNECTED",
    source: "SIMULATOR",
    tiktok: tiktokBridgeClient.getState(),
    bridge: tiktokBridgeClient.getBridgeState(),
    eventStream: [],
    selectedEvent: null,
    metrics: liveEventBus.getMetrics(),
    recording: false,
    recordedCount: 0,
    lastRecording: null,
    replaying: false,
    replaySpeed: 1,
    username: "tao_test",
    userId: "test-user-01",
    team: "NONE",
    generatedViewers: [],
    giftSlots: GIFT_SLOTS,
    giftQuantity: 1,
    customQuantity: "",
    comboActive: false,
    comboId: null,
    comboCount: 0,
    likesPerSecActive: false,
    likesPerSec: 0,
    commentText: "",
    rawGiftId: "rose",
    rawGiftName: "Rose",
    rawGiftRepeat: 1,
    latencyMs: 0,
    scenarioRunning: false,
    giftBridgeActive: false,
    giftsProcessed: 0,
    unitsSpawned: 0,
    crowdActive: false,
    crowdIntensity: 2,

    init: () => {
      if (initialized) return;
      initialized = true;
      liveService.useAdapter(simulatorAdapter);
      const unsubscribeTikTokState = tiktokBridgeClient.subscribeState((tiktok) => {
        if (get().source === "TIKTOK") set({ tiktok, status: tiktok.status });
      });
      const unsubscribeBridgeState = tiktokBridgeClient.subscribeBridgeState((bridge) => {
        set({ bridge });
      });
      liveEventBus.subscribe((event) => {
        if (event.type === "CONNECTION") {
          set({ status: event.status });
        }
        set((s) => {
          const next = [...s.eventStream, event];
          return {
            eventStream: next.length > MAX_DISPLAY_EVENTS ? next.slice(-MAX_DISPLAY_EVENTS) : next,
            metrics: liveEventBus.getMetrics(),
          };
        });
        if (get().recording) {
          set({ recordedCount: get().recordedCount + 1 });
        }
      });
      liveService.start();
      startGiftBridge();
      set({ giftBridgeActive: true });
      void unsubscribeTikTokState;
      void unsubscribeBridgeState;
    },

    setSource: (source) => {
      if (source === get().source) return;
      liveService.stop();
      if (source === "TIKTOK") liveService.useAdapter(tiktokAdapter);
      else liveService.useAdapter(simulatorAdapter);
      set({ source, status: source === "TIKTOK" ? tiktokBridgeClient.getState().status : simulatorAdapter.getStatus() });
      void liveService.start();
    },

    connectTikTok: (username) => {
      if (get().source !== "TIKTOK") get().setSource("TIKTOK");
      tiktokAdapter.connect(username);
    },

    disconnectTikTok: () => tiktokAdapter.disconnect(),
    reconnectTikTok: () => tiktokAdapter.reconnect(),

    setUsername: (v) => set({ username: v }),
    setUserId: (v) => set({ userId: v }),
    setTeam: (t) => set({ team: t }),
    setGiftQuantity: (n) => set({ giftQuantity: n }),
    setCustomQuantity: (v) => set({ customQuantity: v }),
    setCommentText: (v) => set({ commentText: v }),
    setRawGiftId: (v) => set({ rawGiftId: v }),
    setRawGiftName: (v) => set({ rawGiftName: v }),
    setRawGiftRepeat: (n) => set({ rawGiftRepeat: n }),
    setReplaySpeed: (s) => set({ replaySpeed: s }),
    setLatency: (ms) => {
      set({ latencyMs: ms });
      simulatorAdapter.setLatency(ms);
    },
    selectEvent: (e) => set({ selectedEvent: e }),

    applyUserToAdapter: () => {
      simulatorAdapter.setCurrentUser({
        userId: get().userId,
        username: get().username,
        team: get().team,
      });
    },

    sendLike: (count) => {
      get().applyUserToAdapter();
      simulatorAdapter.emitLike(count);
    },

    sendComment: (text) => {
      const t = (text ?? get().commentText).trim();
      if (!t) return;
      get().applyUserToAdapter();
      simulatorAdapter.emitComment(t);
      if (!text) set({ commentText: "" });
    },

    sendGiftByTier: (tier) => {
      get().applyUserToAdapter();
      const slot = GIFT_SLOTS.find((s) => s.tier === tier);
      if (!slot) return;
      const qty = get().giftQuantity;
      if (get().comboActive) {
        get().addComboRepeat(qty);
        return;
      }
      simulatorAdapter.emitGift({
        giftId: slot.simulatorGiftId,
        giftName: slot.simulatorGiftName,
        repeatCount: qty,
        valueMetadata: slot.targetPriceEuro,
      });
    },

    sendRawGift: () => {
      get().applyUserToAdapter();
      simulatorAdapter.emitGift({
        giftId: get().rawGiftId,
        giftName: get().rawGiftName,
        repeatCount: get().rawGiftRepeat,
      });
    },

    sendFollow: () => { get().applyUserToAdapter(); simulatorAdapter.emitFollow(); },
    sendShare: () => { get().applyUserToAdapter(); simulatorAdapter.emitShare(); },
    sendJoin: () => { get().applyUserToAdapter(); simulatorAdapter.emitJoin(); },
    sendLeave: () => { get().applyUserToAdapter(); simulatorAdapter.emitLeave(); },

    startCombo: () => {
      const id = crypto.randomUUID();
      set({ comboActive: true, comboId: id, comboCount: 0 });
      get().applyUserToAdapter();
      const slot = GIFT_SLOTS[0];
      simulatorAdapter.emitGift({
        giftId: slot.simulatorGiftId,
        giftName: slot.simulatorGiftName,
        repeatCount: 1,
        comboId: id,
        comboState: "START",
      });
      set({ comboCount: 1 });
    },

    addComboRepeat: (n) => {
      const { comboId, comboCount } = get();
      if (!comboId) return;
      get().applyUserToAdapter();
      const slot = GIFT_SLOTS[0];
      simulatorAdapter.emitGift({
        giftId: slot.simulatorGiftId,
        giftName: slot.simulatorGiftName,
        repeatCount: n,
        comboId: comboId,
        comboState: "IN_PROGRESS",
      });
      set({ comboCount: comboCount + n });
    },

    finishCombo: () => {
      const { comboId, comboCount } = get();
      if (!comboId) return;
      get().applyUserToAdapter();
      const slot = GIFT_SLOTS[0];
      simulatorAdapter.emitGift({
        giftId: slot.simulatorGiftId,
        giftName: slot.simulatorGiftName,
        repeatCount: comboCount,
        comboId: comboId,
        comboState: "END",
      });
      set({ comboActive: false, comboId: null, comboCount: 0 });
    },

    startLikesPerSec: (cps) => {
      if (likesInterval) clearInterval(likesInterval);
      set({ likesPerSecActive: true, likesPerSec: cps });
      get().applyUserToAdapter();
      likesInterval = setInterval(() => {
        simulatorAdapter.emitLike(cps);
      }, 1000);
    },

    stopLikesPerSec: () => {
      if (likesInterval) {
        clearInterval(likesInterval);
        likesInterval = null;
      }
      set({ likesPerSecActive: false, likesPerSec: 0 });
    },

    generateViewers: (count) => {
      const viewers: GeneratedViewer[] = [];
      for (let i = 0; i < count; i++) {
        const id = crypto.randomUUID().slice(0, 8);
        viewers.push(makeUser(`user-${id}`, `viewer_${id}`));
      }
      set((s) => ({ generatedViewers: [...s.generatedViewers, ...viewers] }));
    },

    selectViewer: (v) => {
      set({ userId: v.userId, username: v.username, team: v.team });
    },

    selectPreset: (n) => {
      const presets = [
        { userId: "viewer-001", username: "viewer_001", team: "A" as TeamSide },
        { userId: "viewer-002", username: "viewer_002", team: "B" as TeamSide },
        { userId: "viewer-003", username: "viewer_003", team: "NONE" as TeamSide },
      ];
      const p = presets[n] ?? presets[0];
      set({ userId: p.userId, username: p.username, team: p.team });
    },

    selectRandomViewer: () => {
      const v = randomViewer();
      set({ userId: v.userId, username: v.username, team: v.team });
    },

    runScenario: (name) => {
      get().applyUserToAdapter();
      switch (name) {
        case "T1_SPAM": {
          for (let i = 0; i < 20; i++) {
            scenarioTimers.push(setTimeout(() => {
              simulatorAdapter.emitGift({ giftId: "sim_t1", giftName: "Sim T1 Basic", repeatCount: 1, valueMetadata: 0.01 });
            }, i * 100));
          }
          break;
        }
        case "T2_FIRE_SUPPORT": {
          for (let i = 0; i < 5; i++) {
            scenarioTimers.push(setTimeout(() => {
              simulatorAdapter.emitGift({ giftId: "sim_t2", giftName: "Sim T2 Specialist", repeatCount: 1, valueMetadata: 0.10 });
            }, i * 300));
          }
          break;
        }
        case "HEALER_SUPPORT": {
          for (let i = 0; i < 3; i++) {
            scenarioTimers.push(setTimeout(() => {
              simulatorAdapter.emitGift({ giftId: "sim_t3", giftName: "Sim T3 Healer", repeatCount: 1, valueMetadata: 0.50 });
            }, i * 500));
          }
          break;
        }
        case "BREAKER_PUSH": {
          simulatorAdapter.emitGift({ giftId: "sim_t4", giftName: "Sim T4 Breaker", repeatCount: 1, valueMetadata: 2 });
          break;
        }
        case "BOSS_SUMMON": {
          simulatorAdapter.emitGift({ giftId: "sim_t5", giftName: "Sim T5 Boss", repeatCount: 1, valueMetadata: 5 });
          break;
        }
        case "ULTIMATE_EVENT": {
          simulatorAdapter.emitGift({ giftId: "sim_t6", giftName: "Sim T6 Ultimate", repeatCount: 1, valueMetadata: 20 });
          break;
        }
        case "TEAM_A_PUSH": {
          simulatorAdapter.setCurrentUser({ userId: "viewer-001", username: "viewer_001", team: "A" });
          for (let i = 0; i < 10; i++) {
            scenarioTimers.push(setTimeout(() => {
              simulatorAdapter.emitGift({ giftId: "sim_t1", giftName: "Sim T1 Basic", repeatCount: 1, valueMetadata: 0.01 });
            }, i * 200));
          }
          scenarioTimers.push(setTimeout(() => {
            simulatorAdapter.emitGift({ giftId: "sim_t4", giftName: "Sim T4 Breaker", repeatCount: 1, valueMetadata: 2 });
          }, 2000));
          break;
        }
        case "TEAM_B_PUSH": {
          simulatorAdapter.setCurrentUser({ userId: "viewer-002", username: "viewer_002", team: "B" });
          for (let i = 0; i < 10; i++) {
            scenarioTimers.push(setTimeout(() => {
              simulatorAdapter.emitGift({ giftId: "sim_t1", giftName: "Sim T1 Basic", repeatCount: 1, valueMetadata: 0.01 });
            }, i * 200));
          }
          scenarioTimers.push(setTimeout(() => {
            simulatorAdapter.emitGift({ giftId: "sim_t5", giftName: "Sim T5 Boss", repeatCount: 1, valueMetadata: 5 });
          }, 2000));
          break;
        }
        case "MASS_GIFT_BURST": {
          for (let i = 0; i < 50; i++) {
            const slot = GIFT_SLOTS[i % 6];
            scenarioTimers.push(setTimeout(() => {
              simulatorAdapter.emitGift({ giftId: slot.simulatorGiftId, giftName: slot.simulatorGiftName, repeatCount: 1, valueMetadata: slot.targetPriceEuro });
            }, i * 50));
          }
          break;
        }
        case "LIKE_STORM": {
          for (let i = 0; i < 50; i++) {
            scenarioTimers.push(setTimeout(() => {
              simulatorAdapter.emitLike(100);
            }, i * 100));
          }
          break;
        }
        case "CHEST_TEAM_A_CLOSE_WIN": {
          chestManager.setChestProgress(99);
          simulatorAdapter.setCurrentUser({ userId: "chest-a", username: "chest_a", team: "A" });
          simulatorAdapter.emitChestContribution(10);
          simulatorAdapter.setCurrentUser({ userId: "chest-b", username: "chest_b", team: "B" });
          simulatorAdapter.emitChestContribution(8);
          scenarioTimers.push(setTimeout(() => simulatorAdapter.emitLike(200), 500));
          break;
        }
        case "CHEST_TEAM_B_CLOSE_WIN": {
          chestManager.setChestProgress(99);
          simulatorAdapter.setCurrentUser({ userId: "chest-a", username: "chest_a", team: "A" });
          simulatorAdapter.emitChestContribution(7);
          simulatorAdapter.setCurrentUser({ userId: "chest-b", username: "chest_b", team: "B" });
          simulatorAdapter.emitChestContribution(12);
          scenarioTimers.push(setTimeout(() => simulatorAdapter.emitLike(200), 500));
          break;
        }
        case "CHEST_TIE": {
          chestManager.setChestProgress(99);
          simulatorAdapter.setCurrentUser({ userId: "chest-a", username: "chest_a", team: "A" });
          simulatorAdapter.emitChestContribution(10);
          simulatorAdapter.setCurrentUser({ userId: "chest-b", username: "chest_b", team: "B" });
          simulatorAdapter.emitChestContribution(10);
          scenarioTimers.push(setTimeout(() => simulatorAdapter.emitLike(200), 500));
          break;
        }
        case "CHEST_99": {
          chestManager.setChestProgress(99);
          simulatorAdapter.setCurrentUser({ userId: "chest-a", username: "chest_a", team: "A" });
          simulatorAdapter.emitChestContribution(5);
          simulatorAdapter.setCurrentUser({ userId: "chest-b", username: "chest_b", team: "B" });
          simulatorAdapter.emitChestContribution(5);
          break;
        }
        case "CHEST_LAST_SECOND_SWING": {
          chestManager.setChestProgress(99);
          simulatorAdapter.setCurrentUser({ userId: "chest-a", username: "chest_a", team: "A" });
          simulatorAdapter.emitChestContribution(10);
          simulatorAdapter.setCurrentUser({ userId: "chest-b", username: "chest_b", team: "B" });
          simulatorAdapter.emitChestContribution(8);
          scenarioTimers.push(setTimeout(() => {
            simulatorAdapter.setCurrentUser({ userId: "chest-b2", username: "chest_b2", team: "B" });
            simulatorAdapter.emitChestContribution(5);
          }, 300));
          scenarioTimers.push(setTimeout(() => simulatorAdapter.emitLike(200), 800));
          break;
        }
      }
    },

    runRealisticLive: (durationSec, viewers, likesPerSec, commentsPerMin, giftFreqSec) => {
      set({ scenarioRunning: true });
      const viewerList: GeneratedViewer[] = [];
      for (let i = 0; i < viewers; i++) {
        const id = crypto.randomUUID().slice(0, 8);
        viewerList.push(makeUser(`user-${id}`, `viewer_${id}`));
      }
      // Initial joins
      for (let i = 0; i < Math.min(viewers, 20); i++) {
        scenarioTimers.push(setTimeout(() => {
          simulatorAdapter.setCurrentUser(viewerList[i]);
          simulatorAdapter.emitJoin();
        }, i * 200));
      }
      // Likes
      const likeInterval = Math.max(1, 1000 / likesPerSec);
      let likeCount = 0;
      const likeTimer = setInterval(() => {
        if (likeCount >= durationSec * likesPerSec) { clearInterval(likeTimer); return; }
        const v = viewerList[Math.floor(Math.random() * viewerList.length)];
        simulatorAdapter.setCurrentUser(v);
        simulatorAdapter.emitLike(1);
        likeCount++;
      }, likeInterval);
      scenarioTimers.push(setTimeout(() => clearInterval(likeTimer), durationSec * 1000));
      // Comments
      const commentInterval = (60 / commentsPerMin) * 1000;
      const commentTexts = ["RED", "BLUE", "TEAM A", "TEAM B", "GO", "ATTACK", "DEFEND", "GG"];
      let commentCount = 0;
      const commentTimer = setInterval(() => {
        if (commentCount >= (commentsPerMin / 60) * durationSec) { clearInterval(commentTimer); return; }
        const v = viewerList[Math.floor(Math.random() * viewerList.length)];
        simulatorAdapter.setCurrentUser(v);
        simulatorAdapter.emitComment(commentTexts[Math.floor(Math.random() * commentTexts.length)]);
        commentCount++;
      }, commentInterval);
      scenarioTimers.push(setTimeout(() => clearInterval(commentTimer), durationSec * 1000));
      // Gifts
      const giftInterval = giftFreqSec * 1000;
      let giftCount = 0;
      const giftTimer = setInterval(() => {
        const maxGifts = Math.floor(durationSec / giftFreqSec);
        if (giftCount >= maxGifts) { clearInterval(giftTimer); return; }
        const v = viewerList[Math.floor(Math.random() * viewerList.length)];
        simulatorAdapter.setCurrentUser(v);
        const r = Math.random();
        const slot = r < 0.7 ? GIFT_SLOTS[0] : r < 0.9 ? GIFT_SLOTS[2] : r < 0.98 ? GIFT_SLOTS[3] : GIFT_SLOTS[5];
        simulatorAdapter.emitGift({ giftId: slot.simulatorGiftId, giftName: slot.simulatorGiftName, repeatCount: 1, valueMetadata: slot.targetPriceEuro });
        giftCount++;
      }, giftInterval);
      scenarioTimers.push(setTimeout(() => clearInterval(giftTimer), durationSec * 1000));
      // End
      scenarioTimers.push(setTimeout(() => {
        set({ scenarioRunning: false });
      }, durationSec * 1000));
    },

    runChaos: (durationSec) => {
      set({ scenarioRunning: true });
      const viewers: GeneratedViewer[] = [];
      for (let i = 0; i < 20; i++) {
        const id = crypto.randomUUID().slice(0, 8);
        viewers.push(makeUser(`user-${id}`, `viewer_${id}`));
      }
      chaosInterval = setInterval(() => {
        const v = viewers[Math.floor(Math.random() * viewers.length)];
        simulatorAdapter.setCurrentUser(v);
        const r = Math.random();
        if (r < 0.3) simulatorAdapter.emitLike(Math.ceil(Math.random() * 100));
        else if (r < 0.5) simulatorAdapter.emitComment(["RED", "BLUE", "TEAM A", "TEAM B"][Math.floor(Math.random() * 4)]);
        else if (r < 0.7) {
          const slot = GIFT_SLOTS[Math.floor(Math.random() * 6)];
          simulatorAdapter.emitGift({ giftId: slot.simulatorGiftId, giftName: slot.simulatorGiftName, repeatCount: 1, valueMetadata: slot.targetPriceEuro });
        }
        else if (r < 0.8) simulatorAdapter.emitShare();
        else if (r < 0.9) simulatorAdapter.emitFollow();
        else simulatorAdapter.emitJoin();
      }, 200);
      scenarioTimers.push(setTimeout(() => {
        if (chaosInterval) { clearInterval(chaosInterval); chaosInterval = null; }
        set({ scenarioRunning: false });
      }, durationSec * 1000));
    },

    simulateDisconnect: () => simulatorAdapter.simulateDisconnect(),
    simulateReconnect: () => simulatorAdapter.simulateReconnect(),
    simulateError: () => simulatorAdapter.simulateError(),
    dropNextEvent: () => simulatorAdapter.dropNextEvent(),

    duplicateLastEvent: () => {
      const last = liveEventBus.getLastEvent();
      if (!last) return;
      simulatorAdapter.emitRaw(last);
    },

    sendMalformed: (kind) => {
      get().applyUserToAdapter();
      switch (kind) {
        case "UNKNOWN_GIFT":
          simulatorAdapter.emitGift({ giftId: "unknown_xyz", giftName: "???", repeatCount: 1 });
          break;
        case "MISSING_USER": {
          const event = {
            eventId: crypto.randomUUID(),
            type: "GIFT" as const,
            timestamp: Date.now(),
            sequenceNumber: liveEventBus.nextSequence(),
            source: "SIMULATOR" as const,
            giftId: "sim_t1",
            giftName: "Sim T1 Basic",
            repeatCount: 1,
          };
          simulatorAdapter.emitRaw(event);
          break;
        }
        case "INVALID_REPEAT":
          simulatorAdapter.emitGift({ giftId: "sim_t1", giftName: "Sim T1 Basic", repeatCount: -5 });
          break;
        case "EMPTY_COMMENT":
          simulatorAdapter.emitComment("");
          break;
        case "MISSING_GIFT_NAME":
          simulatorAdapter.emitGift({ giftId: "sim_t1", giftName: "", repeatCount: 1 });
          break;
      }
    },

    startRecording: () => {
      liveService.startRecording();
      set({ recording: true, recordedCount: 0 });
    },

    stopRecording: () => {
      const rec = liveService.stopRecording();
      set({ recording: false, lastRecording: rec, recordedCount: 0 });
    },

    replay: () => {
      const rec = get().lastRecording;
      if (!rec || rec.events.length === 0) return;
      if (replayCancel) replayCancel();
      set({ replaying: true });
      const speed = get().replaySpeed;
      if (speed === 0) {
        for (const recorded of rec.events) {
          liveEventBus.emit(recorded.event);
        }
        set({ replaying: false });
        return;
      }
      replayCancel = replayRecording(rec, (event) => {
        liveEventBus.emit(event);
      }, speed).cancel;
      const maxDelay = rec.events.length > 0 ? rec.events[rec.events.length - 1].offsetMs / speed : 0;
      scenarioTimers.push(setTimeout(() => set({ replaying: false }), maxDelay + 100));
    },

    clearEventLog: () => {
      liveEventBus.clearHistory();
      set({ eventStream: [], selectedEvent: null });
    },

    resetSimulator: () => {
      clearScenarioTimers();
      liveEventBus.reset();
      set({
        eventStream: [],
        selectedEvent: null,
        metrics: liveEventBus.getMetrics(),
        recording: false,
        recordedCount: 0,
        lastRecording: null,
        replaying: false,
        status: "DISCONNECTED",
      });
      liveService.start();
    },

    resetViewers: () => set({ generatedViewers: [] }),

    stopAllScenarios: () => clearScenarioTimers(),

    startCrowdSimulation: () => {
      if (crowdInterval) clearInterval(crowdInterval);
      set({ crowdActive: true });
      const intensity = get().crowdIntensity;
      const intervalMs = Math.max(200, 3000 / intensity);
      crowdInterval = setInterval(() => {
        const v = randomViewer();
        simulatorAdapter.setCurrentUser(v);
        const r = Math.random();
        if (r < 0.35) {
          simulatorAdapter.emitLike(Math.ceil(Math.random() * 10));
        } else if (r < 0.55) {
          simulatorAdapter.emitComment(["RED", "BLUE", "TEAM A", "TEAM B"][Math.floor(Math.random() * 4)]);
        } else if (r < 0.85) {
          const weights = [0.50, 0.25, 0.12, 0.07, 0.04, 0.02];
          let roll = Math.random();
          let slot = GIFT_SLOTS[0];
          for (let i = 0; i < weights.length; i++) {
            roll -= weights[i];
            if (roll <= 0) { slot = GIFT_SLOTS[i]; break; }
          }
          simulatorAdapter.emitGift({ giftId: slot.simulatorGiftId, giftName: slot.simulatorGiftName, repeatCount: 1, valueMetadata: slot.targetPriceEuro });
        } else if (r < 0.92) {
          simulatorAdapter.emitFollow();
        } else if (r < 0.97) {
          simulatorAdapter.emitShare();
        } else {
          simulatorAdapter.emitJoin();
        }
        const stats = getGiftBridgeStats();
        set({ giftsProcessed: stats.giftsReceived, unitsSpawned: stats.unitsSpawned });
      }, intervalMs);
    },

    stopCrowdSimulation: () => {
      if (crowdInterval) {
        clearInterval(crowdInterval);
        crowdInterval = null;
      }
      set({ crowdActive: false });
    },

    setCrowdIntensity: (level) => {
      set({ crowdIntensity: level });
      if (get().crowdActive) {
        get().stopCrowdSimulation();
        get().startCrowdSimulation();
      }
    },

    toggleGiftBridge: () => {
      const active = get().giftBridgeActive;
      if (active) {
        stopGiftBridge();
        set({ giftBridgeActive: false });
      } else {
        startGiftBridge();
        set({ giftBridgeActive: true });
      }
    },

    sendChestContribution: (team, points) => {
      get().applyUserToAdapter();
      simulatorAdapter.setCurrentUser({ ...simulatorAdapter.getCurrentUser(), team });
      simulatorAdapter.emitChestContribution(points);
    },

    setChestProgress: (percent) => {
      chestManager.setChestProgress(percent);
    },

    forceUnlockChest: () => {
      chestManager.forceUnlock();
    },

    resetChest: () => {
      chestManager.resetChest();
    },
  };
});
