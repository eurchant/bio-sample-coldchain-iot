<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";
onLaunch(() => {
  console.log("App Launch");
});
onShow(() => {
  console.log("App Show");
});
onHide(() => {
  console.log("App Hide");
});
</script>

<style>
/* ===== 冷链小程序设计令牌（Stripe 视觉定位，详见 miniprogram/DESIGN.md §2）===== */
page {
  /* Brand — Stripe 电光靛蓝，唯一强调色 */
  --cc-primary: #533afd;
  --cc-primary-deep: #4434d4;
  --cc-primary-soft: #665efd;
  --cc-primary-bg: #eeedfc;
  --cc-on-primary: #ffffff;
  /* Surface */
  --cc-canvas: #ffffff;
  --cc-canvas-soft: #f6f9fc;
  --cc-canvas-sunken: #f1f4f9;
  /* Borders */
  --cc-hairline: #e3e8ee;
  --cc-hairline-strong: #d4dbe3;
  /* Text — 深蓝墨色阶 */
  --cc-ink: #0d253d;
  --cc-ink-secondary: #273951;
  --cc-ink-mute: #64748b;
  --cc-ink-faint: #94a3b8;
  /* Semantic — 五态，文字色 + 软底色 */
  --cc-success: #1a8754;  --cc-success-bg: #e6f4ec;
  --cc-warn:    #c47f17;  --cc-warn-bg:    #fbf0dd;
  --cc-crit:    #e0433a;  --cc-crit-bg:    #fceceb;
  --cc-info:    #533afd;  --cc-info-bg:    #eeedfc;
  --cc-neutral: #64748b;  --cc-neutral-bg: #eef1f5;
  /* Elevation — 冷蓝低饱和阴影 */
  --cc-shadow-1: 0 1px 3px rgba(0, 55, 112, 0.08);
  --cc-shadow-2: 0 8px 24px rgba(0, 55, 112, 0.08), 0 2px 6px rgba(0, 55, 112, 0.04);
  --cc-shadow-3: 0 16px 48px rgba(0, 55, 112, 0.16);
  /* RGB variants */
  --cc-primary-rgb: 83, 58, 253;
  --cc-crit-rgb: 224, 67, 58;
  --cc-success-rgb: 26, 135, 84;
  --cc-warn-rgb: 196, 127, 23;

  background-color: var(--cc-canvas-soft);
  color: var(--cc-ink);
  font-family: -apple-system, "PingFang SC", "Helvetica Neue", Helvetica, "Segoe UI", Arial, sans-serif;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
}

/* ===== 通用版式类（DESIGN.md §3）===== */
.cc-eyebrow {
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0.2px;
  color: var(--cc-ink-mute);
  text-transform: uppercase;
}
.cc-card-title {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.2px;
  color: var(--cc-ink);
}
.cc-section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--cc-ink);
}
.cc-caption {
  font-size: 12px;
  color: var(--cc-ink-mute);
}
.cc-metric-xl {
  font-size: 34px;
  font-weight: 300;
  letter-spacing: -0.8px;
  line-height: 1;
  color: var(--cc-ink);
}
.cc-metric-lg {
  font-size: 26px;
  font-weight: 300;
  letter-spacing: -0.5px;
  line-height: 1;
  color: var(--cc-ink);
}
.cc-metric-unit {
  font-size: 12px;
  font-weight: 400;
  color: var(--cc-ink-mute);
}

/* ===== 状态徽标（DESIGN.md §4.2）===== */
.cc-badge {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.2px;
  padding: 3px 10px;
  border-radius: 9999px;
  line-height: 1.4;
}
.cc-badge-sm {
  padding: 2px 8px;
  font-size: 10px;
}
.cc-badge-success { color: var(--cc-success); background: var(--cc-success-bg); }
.cc-badge-warn    { color: var(--cc-warn);    background: var(--cc-warn-bg); }
.cc-badge-crit    { color: var(--cc-crit);    background: var(--cc-crit-bg); }
.cc-badge-info    { color: var(--cc-info);    background: var(--cc-info-bg); }
.cc-badge-neutral { color: var(--cc-neutral); background: var(--cc-neutral-bg); }

/* ===== 页面与卡片（DESIGN.md §4.1 / §5）===== */
.page {
  padding: 12px;
  padding-bottom: 76px;
  background: var(--cc-canvas-soft);
  min-height: 100vh;
}
.card {
  background: var(--cc-canvas);
  border-radius: 12px;
  border: 1px solid var(--cc-hairline);
  padding: 16px;
  margin-bottom: 8px;
  box-shadow: var(--cc-shadow-1);
  box-sizing: border-box;
}
.card:active { background: var(--cc-canvas-sunken); }
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.card-sub {
  font-size: 11px;
  color: var(--cc-ink-faint);
}

/* ===== 任务头共用（monitor / handoff / trace）===== */
.th-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.th-title-wrap {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.th-title {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.2px;
  color: var(--cc-ink);
  line-height: 1.2;
}
.meta-grid {
  display: flex;
  gap: 16px;
  margin-top: 14px;
}
.meta-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.meta-val {
  font-size: 13px;
  color: var(--cc-ink-secondary);
}

/* ===== 时间线（DESIGN.md §4.5，alarms / trace 共用）===== */
.timeline {
  padding-left: 2px;
}
.timeline-item {
  display: flex;
  padding-bottom: 18px;
}
.timeline-item:last-child {
  padding-bottom: 4px;
}
.tl-rail {
  position: relative;
  width: 16px;
  flex-shrink: 0;
  margin-right: 12px;
}
.tl-rail::before {
  content: '';
  position: absolute;
  left: 7px;
  top: 14px;
  bottom: -4px;
  width: 1px;
  background: var(--cc-hairline-strong);
}
.timeline-item:last-child .tl-rail::before {
  display: none;
}
.tl-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  position: absolute;
  left: 3px;
  top: 4px;
  z-index: 1;
  box-shadow: 0 0 0 3px var(--cc-canvas);
}
.dot-success { background: var(--cc-success); }
.dot-warn    { background: var(--cc-warn); }
.dot-crit    { background: var(--cc-crit); }
.dot-info    { background: var(--cc-info); }
.dot-neutral { background: var(--cc-neutral); }
.dot-pending { background: var(--cc-canvas); border: 2px solid var(--cc-hairline-strong); }
.tl-content { flex: 1; }

/* ===== 空态（DESIGN.md §4.9）===== */
.empty-block {
  text-align: center;
  padding: 24px 0;
  color: var(--cc-ink-faint);
  font-size: 13px;
}

/* ===== 按钮（DESIGN.md §4.3）===== */
.cc-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 0.1px;
  padding: 0 16px;
  min-height: 44px;
  line-height: 44px;
  border-radius: 10px;
  border: 1px solid transparent;
  margin: 0;
  box-sizing: border-box;
  transition: background .15s, border-color .15s, opacity .15s;
}
/* 微信小程序 <button> 默认边框清除 */
.cc-btn::after { border: none; }
.cc-btn[disabled] { opacity: 0.4; }
.cc-btn-primary {
  background: var(--cc-primary);
  color: var(--cc-on-primary);
}
.cc-btn-primary:not([disabled]):active { background: var(--cc-primary-deep); }
.cc-btn-secondary {
  background: var(--cc-canvas);
  color: var(--cc-ink);
  border-color: var(--cc-hairline-strong);
}
.cc-btn-secondary:not([disabled]):active { background: var(--cc-canvas-sunken); }
.cc-btn-danger {
  background: var(--cc-canvas);
  color: var(--cc-crit);
  border-color: var(--cc-crit);
}
.cc-btn-danger:not([disabled]):active { background: var(--cc-crit-bg); }
.cc-btn-danger[disabled] { color: var(--cc-ink-faint); border-color: var(--cc-hairline); }
</style>
