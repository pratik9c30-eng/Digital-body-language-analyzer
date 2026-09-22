# Diff Review

## `client/src/capture/mouseCapture.ts`

```diff
diff --git a/client/src/capture/mouseCapture.ts b/client/src/capture/mouseCapture.ts
index bc02c09..c556ad3 100644
--- a/client/src/capture/mouseCapture.ts
+++ b/client/src/capture/mouseCapture.ts
@@ -2,5 +2,5 @@ export type MouseStats = { mouse_velocity: number; mouse_acceleration: number; m
 export class MouseCapture { private points: {x:number;y:number;t:number}[]=[]; private clicks: number[]=[]; private down=0;
   onMove(e: PointerEvent) { const last=this.points[this.points.length-1]; const now=performance.now(); if(last) { const dt=Math.max(1, now-last.t); this.points.push({x:e.clientX,y:e.clientY,t:now}); if(this.points.length>180)this.points.shift(); } else this.points.push({x:e.clientX,y:e.clientY,t:now}); }
   onDown(){this.down=performance.now()} onUp(){if(this.down)this.clicks.push(performance.now()-this.down);this.down=0}
-  snapshot(): MouseStats { const speeds=this.points.slice(1).map((p,i)=>Math.hypot(p.x-this.points[i].x,p.y-this.points[i].y)/Math.max(1,p.t-this.points[i].t)); const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0.3; const accel=speeds.slice(1).map((x,i)=>Math.abs(x-speeds[i])); return {mouse_velocity:Math.min(1,mean(speeds)/2),mouse_acceleration:Math.min(1,mean(accel)/1.5),mouse_curvature:Math.min(1,Math.abs(speeds.length-(new Set(speeds.map(x=>Math.round(x*10))).size))/Math.max(1,speeds.length)),mouse_jitter:Math.min(1,mean(speeds.map(x=>Math.abs(x-mean(speeds))))),click_dwell:Math.min(1,mean(this.clicks)/500)}; }
+  snapshot(): MouseStats { const first=this.points[0]; const last=this.points[this.points.length-1]; const duration=first&&last?Math.max(1,last.t-first.t):1; const pathLength=this.points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-this.points[i].x,p.y-this.points[i].y),0); const displacement=first&&last?Math.hypot(last.x-first.x,last.y-first.y):0; const speeds=this.points.slice(1).map((p,i)=>Math.hypot(p.x-this.points[i].x,p.y-this.points[i].y)/Math.max(1,p.t-this.points[i].t)); const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0.3; const firstSpeed=speeds[0]??0; const lastSpeed=speeds[speeds.length-1]??0; const acceleration=Math.abs(lastSpeed-firstSpeed)/(duration/1000); const curvature=pathLength>0?1-displacement/pathLength:0; return {mouse_velocity:Math.min(1,(displacement/(duration/1000))/2),mouse_acceleration:Math.min(1,acceleration/1.5),mouse_curvature:Math.min(1,Math.max(0,curvature)),mouse_jitter:Math.min(1,mean(speeds.map(x=>Math.abs(x-mean(speeds))))),click_dwell:Math.min(1,mean(this.clicks)/500)}; }
 }
```

## `server/ml/decision_engine.py`

```diff
diff --git a/server/ml/decision_engine.py b/server/ml/decision_engine.py
index e4d98bc..d5cfbfc 100644
--- a/server/ml/decision_engine.py
+++ b/server/ml/decision_engine.py
@@ -32,6 +32,12 @@ class DecisionEngine:
         self.model = model
         self.config = config or DecisionConfig()
         self.ewma = 0.0
+        self.ewma_by_behavior: dict[str, float] = {}
+        self.samples_seen_by_behavior: dict[str, int] = {}
+        self.consecutive_above_by_behavior: dict[str, int] = {}
+        self.consecutive_stable_by_behavior: dict[str, int] = {}
+        self.previous_vector: np.ndarray | None = None
+        self.active_behavior: str | None = None
         self.samples_seen = 0
         self.recent_scores: deque[float] = deque(maxlen=12)
         self.consecutive_above = 0
@@ -69,20 +75,47 @@ class DecisionEngine:
         agreement = float(np.mean(signal_scores >= 0.48))
         return signal_strength, agreement, signal_scores.tolist()
 
+    @staticmethod
+    def _behavior_for(signal_scores: np.ndarray, vector: np.ndarray, previous_vector: np.ndarray | None, active_behavior: str | None) -> str:
+        groups = {
+            "typing": slice(0, 5),
+            "mouse": slice(5, 10),
+            "scroll": slice(10, 12),
+            "touch": slice(12, 14),
+            "timing": slice(14, 15),
+        }
+        if previous_vector is not None:
+            changes = {name: float(np.mean(np.abs(vector[group] - previous_vector[group]))) for name, group in groups.items()}
+            if max(changes.values()) > 0.001:
+                return max(changes, key=changes.get)
+            if active_behavior is not None:
+                return active_behavior
+        return max(groups, key=lambda name: float(np.mean(signal_scores[groups[name]])))
+
     def score(self, vector: list[float]) -> Any:
         anomaly, z = self.model.score(vector)
         z = np.asarray(z, dtype=float)
-        signal_strength, signal_agreement, _ = self._signal_anomaly(z)
+        signal_strength, signal_agreement, signal_values = self._signal_anomaly(z)
+        behavior = self._behavior_for(np.asarray(signal_values, dtype=float), np.asarray(vector, dtype=float), self.previous_vector, self.active_behavior)
+        self.active_behavior = behavior
+        self.previous_vector = np.asarray(vector, dtype=float)
+        behavior_ewma = self.ewma_by_behavior.get(behavior, 0.0)
+        behavior_samples_seen = self.samples_seen_by_behavior.get(behavior, 0)
+        behavior_consecutive_above = self.consecutive_above_by_behavior.get(behavior, 0)
+        behavior_consecutive_stable = self.consecutive_stable_by_behavior.get(behavior, 0)
         base_anomaly = float(np.clip(0.7 * anomaly + 0.3 * signal_strength, 0.0, 1.0))
         calibration = self.estimate_calibration_quality(self.model.vectors)
-        confidence = float(calibration["confidence"]) * (0.6 + 0.4 * min(1.0, self.samples_seen / max(1, self.config.warmup_samples + 2)))
-        if self.samples_seen < self.config.warmup_samples:
+        confidence = float(calibration["confidence"]) * (0.6 + 0.4 * min(1.0, behavior_samples_seen / max(1, self.config.warmup_samples + 2)))
+        if behavior_samples_seen < self.config.warmup_samples:
             decision = "TRUSTED"
-            self.samples_seen += 1
-            self.ewma = 0.20 * base_anomaly + 0.80 * self.ewma
-            self.recent_scores.append(self.ewma)
+            behavior_samples_seen += 1
+            behavior_ewma = 0.20 * base_anomaly + 0.80 * behavior_ewma
+            self.ewma_by_behavior[behavior] = behavior_ewma
+            self.samples_seen_by_behavior[behavior] = behavior_samples_seen
+            self.ewma = behavior_ewma
+            self.recent_scores.append(behavior_ewma)
             self.state = decision
-            trust_score = float(np.clip(100.0 - (self.ewma * 60.0), 70.0, 100.0))
+            trust_score = float(np.clip(100.0 - (behavior_ewma * 60.0), 70.0, 100.0))
             result = {
                 "trust_score": round(trust_score, 1),
                 "tier": "silent",
@@ -90,6 +123,8 @@ class DecisionEngine:
                 "signal_agreement": round(signal_agreement, 3),
                 "decision_confidence": round(float(np.clip(confidence, 0.0, 1.0)), 3),
                 "behavioral_anomaly": round(base_anomaly, 3),
+                "behavior": behavior,
+                "ewma": round(behavior_ewma, 3),
                 "calibration_quality": calibration["status"],
                 "reasons": explain(z.tolist()),
                 "automation_likelihood": 0.0,
@@ -98,34 +133,42 @@ class DecisionEngine:
             }
             return type("DecisionResult", (), result)()
 
-        self.ewma = self.config.smoothing_alpha * base_anomaly + (1.0 - self.config.smoothing_alpha) * self.ewma
-        self.recent_scores.append(self.ewma)
-        if self.ewma >= self.config.entry_threshold:
-            self.consecutive_above += 1
-            self.consecutive_stable = 0
+        behavior_ewma = self.config.smoothing_alpha * base_anomaly + (1.0 - self.config.smoothing_alpha) * behavior_ewma
+        self.ewma_by_behavior[behavior] = behavior_ewma
+        self.samples_seen_by_behavior[behavior] = behavior_samples_seen + 1
+        self.ewma = behavior_ewma
+        self.samples_seen += 1
+        self.recent_scores.append(behavior_ewma)
+        if behavior_ewma >= self.config.entry_threshold:
+            behavior_consecutive_above += 1
+            behavior_consecutive_stable = 0
         else:
-            self.consecutive_above = 0
-            self.consecutive_stable += 1
+            behavior_consecutive_above = 0
+            behavior_consecutive_stable += 1
+        self.consecutive_above_by_behavior[behavior] = behavior_consecutive_above
+        self.consecutive_stable_by_behavior[behavior] = behavior_consecutive_stable
+        self.consecutive_above = behavior_consecutive_above
+        self.consecutive_stable = behavior_consecutive_stable
 
-        if self.ewma <= self.config.exit_threshold:
+        if behavior_ewma <= self.config.exit_threshold:
             decision = "TRUSTED"
-        elif self.ewma >= self.config.lock_threshold and self.consecutive_above >= 3 and signal_agreement >= 0.5 and confidence >= self.config.min_confidence:
+        elif behavior_ewma >= self.config.lock_threshold and behavior_consecutive_above >= 3 and signal_agreement >= 0.5 and confidence >= self.config.min_confidence:
             decision = "RESTRICTED"
-        elif self.ewma >= self.config.challenge_threshold and self.consecutive_above >= 2 and signal_agreement >= 0.45 and confidence >= self.config.min_confidence:
+        elif behavior_ewma >= self.config.challenge_threshold and behavior_consecutive_above >= 2 and signal_agreement >= 0.45 and confidence >= self.config.min_confidence:
             decision = "CHALLENGE"
-        elif self.ewma >= self.config.watch_threshold and self.consecutive_above >= 2 and signal_agreement >= self.config.signal_agreement_min:
+        elif behavior_ewma >= self.config.watch_threshold and behavior_consecutive_above >= 2 and signal_agreement >= self.config.signal_agreement_min:
             decision = "WATCH"
-        elif self.ewma >= self.config.entry_threshold and self.consecutive_above >= 1:
+        elif behavior_ewma >= self.config.entry_threshold and behavior_consecutive_above >= 1:
             decision = "OBSERVING"
         else:
             decision = "TRUSTED"
 
-        if decision == "TRUSTED" and self.consecutive_stable >= 3:
+        if decision == "TRUSTED" and behavior_consecutive_stable >= 3:
             self.state = "TRUSTED"
         elif decision in {"OBSERVING", "WATCH", "CHALLENGE", "RESTRICTED"}:
             self.state = decision
 
-        trust_score = float(np.clip(100.0 * (1.0 - min(1.0, self.ewma * 0.8 + max(0.0, 1.0 - confidence) * 0.2)), 0.0, 100.0))
+        trust_score = float(np.clip(100.0 * (1.0 - min(1.0, behavior_ewma * 0.8 + max(0.0, 1.0 - confidence) * 0.2)), 0.0, 100.0))
         if decision == "TRUSTED":
             trust_score = max(trust_score, 80.0)
         if decision == "OBSERVING":
@@ -148,11 +191,12 @@ class DecisionEngine:
             "behavioral_anomaly": round(float(base_anomaly), 3),
+            "behavior": behavior,
+            "ewma": round(behavior_ewma, 3),
             "calibration_quality": calibration["status"],
             "reasons": explain(z.tolist()),
             "automation_likelihood": round(float(np.mean(np.abs(z[::3])) / 4.0, 3)),
             "context_confidence": round(float(np.clip(confidence * (1.0 - 0.35 * (1.0 - signal_agreement)), 0.0, 1.0)), 3),
             "overall_trust": round(trust_score, 1),
         }
-        self.samples_seen += 1
         return type("DecisionResult", (), result)()
