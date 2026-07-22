import React from "react";
import "./CircuitBackground.css";

/**
 * خلفية دارة إلكترونية متحركة — أرضية كحلية + خطوط برتقالية مضيئة تتحرك،
 * نقاط لحام نابضة، ورقاقة إلكترونية في المنتصف تتوهّج بالحياة.
 * SVG مستقل بالكامل (بدون مكتبات). يحترم prefers-reduced-motion عبر CSS.
 */
const CircuitBackground: React.FC = () => {
  // مسارات الدارة داخل viewBox 1200x600. pathLength=100 يوحّد حركة النبضة على كل المسارات.
  const traces = [
    "M0,90 H280 Q300,90 300,110 V210 H560",
    "M1200,130 H900 Q880,130 880,150 V280 H540",
    "M0,300 H180 Q200,300 200,320 V430 H520",
    "M1200,350 H840 Q820,350 820,370 V500 H420",
    "M120,600 V470 Q120,450 140,450 H460",
    "M1080,600 V430 Q1080,410 1060,410 H720",
    "M0,520 H150 Q170,520 170,500 V400 H380",
    "M1200,70 H1000 Q980,70 980,90 V200 H780",
  ];

  // نقاط اللحام (أطراف/تقاطعات المسارات)
  const nodes: [number, number][] = [
    [560, 210], [540, 280], [520, 430], [420, 500],
    [460, 450], [720, 410], [380, 400], [780, 200],
    [300, 110], [880, 150], [200, 320], [820, 370],
  ];

  return (
    <div className="circuit-bg" aria-hidden="true">
      <svg
        className="circuit-svg"
        viewBox="0 0 1200 600"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="circuitGlow" cx="50%" cy="42%" r="80%">
            <stop offset="0%" stopColor="#143b6e" />
            <stop offset="55%" stopColor="#0b2749" />
            <stop offset="100%" stopColor="#06132b" />
          </radialGradient>
          <filter id="circuitNeon" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* الأرضية الكحلية */}
        <rect width="1200" height="600" fill="url(#circuitGlow)" />

        {/* الخطوط الخافتة (الأساس) */}
        <g className="circuit-traces-base">
          {traces.map((d, i) => (
            <path key={`b${i}`} d={d} />
          ))}
        </g>

        {/* الخطوط المضيئة المتحركة */}
        <g className="circuit-traces-glow">
          {traces.map((d, i) => (
            <path
              key={`g${i}`}
              d={d}
              pathLength={100}
              style={{
                animationDuration: `${3 + (i % 4) * 0.9}s`,
                animationDelay: `${i * 0.55}s`,
              }}
            />
          ))}
        </g>

        {/* نقاط اللحام النابضة */}
        <g className="circuit-nodes" filter="url(#circuitNeon)">
          {nodes.map(([cx, cy], i) => (
            <circle
              key={`n${i}`}
              cx={cx}
              cy={cy}
              r={4.5}
              style={{ animationDelay: `${(i % 6) * 0.4}s` }}
            />
          ))}
        </g>

        {/* الرقاقة الإلكترونية المركزية */}
        <g className="circuit-chip" filter="url(#circuitNeon)" transform="translate(600 300)">
          <rect x="-58" y="-42" width="116" height="84" rx="12" className="chip-body" />
          <rect x="-40" y="-26" width="80" height="52" rx="7" className="chip-core" />
          <circle cx="0" cy="0" r="7" className="chip-dot" />
          {[-33, -11, 11, 33].map((x) => (
            <React.Fragment key={`v${x}`}>
              <line x1={x} y1={-42} x2={x} y2={-58} className="chip-pin" />
              <line x1={x} y1={42} x2={x} y2={58} className="chip-pin" />
            </React.Fragment>
          ))}
          {[-22, 0, 22].map((y) => (
            <React.Fragment key={`h${y}`}>
              <line x1={-58} y1={y} x2={-74} y2={y} className="chip-pin" />
              <line x1={58} y1={y} x2={74} y2={y} className="chip-pin" />
            </React.Fragment>
          ))}
        </g>
      </svg>
    </div>
  );
};

export default CircuitBackground;
