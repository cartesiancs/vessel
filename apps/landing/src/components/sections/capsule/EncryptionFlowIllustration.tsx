function EncryptionFlowIllustration() {
  return (
    <svg
      viewBox='0 0 900 360'
      className='h-full w-full'
      role='img'
      aria-label='Encryption flow diagram showing Client to Server to AI'
    >
      <defs>
        {/* Subtle dot grid instead of lines — cleaner, more tactical */}
        <pattern
          id='dot-grid'
          width='24'
          height='24'
          patternUnits='userSpaceOnUse'
        >
          <circle cx='0.5' cy='0.5' r='0.5' fill='rgba(255,255,255,0.07)' />
        </pattern>

        {/* Scanline overlay */}
        <pattern
          id='scanlines'
          width='4'
          height='4'
          patternUnits='userSpaceOnUse'
        >
          <line
            x1='0'
            y1='0'
            x2='4'
            y2='0'
            stroke='rgba(255,255,255,0.015)'
            strokeWidth='1'
          />
        </pattern>

        {/* Glow filter for nodes */}
        <filter id='node-glow' x='-50%' y='-50%' width='200%' height='200%'>
          <feGaussianBlur in='SourceGraphic' stdDeviation='6' result='blur' />
          <feComposite in='SourceGraphic' in2='blur' operator='over' />
        </filter>

        {/* Ping pulse filter */}
        <filter id='ping-blur' x='-100%' y='-100%' width='300%' height='300%'>
          <feGaussianBlur stdDeviation='3' />
        </filter>

        <style>
          {`
            @keyframes dash-flow {
              to { stroke-dashoffset: -36; }
            }
            @keyframes pulse-ring {
              0% { r: 36; opacity: 0.3; }
              100% { r: 56; opacity: 0; }
            }
            @keyframes packet-pulse {
              0%, 100% { opacity: 0.9; }
              50% { opacity: 0.4; }
            }
            @keyframes status-blink {
              0%, 90% { opacity: 1; }
              95% { opacity: 0.2; }
              100% { opacity: 1; }
            }
            .flow-line {
              stroke: rgba(255,255,255,0.1);
              stroke-width: 1;
              fill: none;
            }
            .flow-dash {
              stroke: rgba(255,255,255,0.3);
              stroke-dasharray: 6 12;
              stroke-width: 1;
              fill: none;
              animation: dash-flow 2s linear infinite;
            }
            .node-label {
              font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
              letter-spacing: 0.08em;
              text-transform: uppercase;
            }
            .status-dot {
              animation: status-blink 3s ease-in-out infinite;
            }
          `}
        </style>

        {/* Main route path */}
        <path
          id='main-route'
          d='M150,180 C260,180 310,120 450,120 C590,120 640,180 750,180'
        />

        {/* Return route (faint) */}
        <path
          id='return-route'
          d='M750,180 C640,180 590,240 450,240 C310,240 260,180 150,180'
        />
      </defs>

      {/* Background layers */}
      <rect width='900' height='360' fill='url(#dot-grid)' />
      <rect width='900' height='360' fill='url(#scanlines)' />

      {/* Coordinate markers — subtle tactical framing */}
      <text
        x='16'
        y='20'
        fill='rgba(255,255,255,0.1)'
        fontSize='8'
        fontFamily='monospace'
      >
        00:00
      </text>
      <text
        x='860'
        y='20'
        fill='rgba(255,255,255,0.1)'
        fontSize='8'
        fontFamily='monospace'
        textAnchor='end'
      >
        SEC.FLOW
      </text>
      <text
        x='16'
        y='352'
        fill='rgba(255,255,255,0.1)'
        fontSize='8'
        fontFamily='monospace'
      >
        E2E.ENC
      </text>

      {/* Corner brackets — military HUD style */}
      {/* Top-left */}
      <path
        d='M8,28 L8,8 L28,8'
        fill='none'
        stroke='rgba(255,255,255,0.08)'
        strokeWidth='1'
      />
      {/* Top-right */}
      <path
        d='M872,8 L892,8 L892,28'
        fill='none'
        stroke='rgba(255,255,255,0.08)'
        strokeWidth='1'
      />
      {/* Bottom-left */}
      <path
        d='M8,332 L8,352 L28,352'
        fill='none'
        stroke='rgba(255,255,255,0.08)'
        strokeWidth='1'
      />
      {/* Bottom-right */}
      <path
        d='M872,352 L892,352 L892,332'
        fill='none'
        stroke='rgba(255,255,255,0.08)'
        strokeWidth='1'
      />

      {/* Connection lines — forward route */}
      <use href='#main-route' className='flow-line' />
      <use href='#main-route' className='flow-dash' />

      {/* Return route — barely visible */}
      <path
        d='M750,180 C640,180 590,240 450,240 C310,240 260,180 150,180'
        stroke='rgba(255,255,255,0.04)'
        strokeWidth='1'
        strokeDasharray='2 16'
        fill='none'
      />

      {/* Animated packet — forward */}
      <g>
        <g style={{ animation: "packet-pulse 1.5s ease-in-out infinite" }}>
          <rect
            width='12'
            height='4'
            rx='1'
            fill='rgba(255,255,255,0.6)'
            x='-6'
            y='-2'
          >
            <animateMotion dur='3.5s' repeatCount='indefinite'>
              <mpath href='#main-route' />
            </animateMotion>
          </rect>
          <rect
            width='12'
            height='4'
            rx='1'
            fill='rgba(255,255,255,0.15)'
            x='-6'
            y='-2'
            filter='url(#ping-blur)'
          >
            <animateMotion dur='3.5s' repeatCount='indefinite'>
              <mpath href='#main-route' />
            </animateMotion>
          </rect>
        </g>
      </g>

      {/* Second packet — staggered */}
      <g opacity='0.4'>
        <rect width='6' height='2' rx='1' fill='rgba(255,255,255,0.5)'>
          <animateMotion dur='3.5s' repeatCount='indefinite' begin='1.75s'>
            <mpath href='#main-route' />
          </animateMotion>
        </rect>
      </g>

      {/* ==================== CLIENT NODE ==================== */}
      <g transform='translate(150,180)'>
        {/* Pulse ring */}
        <circle
          r='36'
          fill='none'
          stroke='rgba(255,255,255,0.15)'
          strokeWidth='0.5'
        >
          <animate
            attributeName='r'
            values='36;56'
            dur='3s'
            repeatCount='indefinite'
          />
          <animate
            attributeName='opacity'
            values='0.3;0'
            dur='3s'
            repeatCount='indefinite'
          />
        </circle>

        {/* Crosshair marks */}
        <line
          x1='-44'
          y1='0'
          x2='-38'
          y2='0'
          stroke='rgba(255,255,255,0.15)'
          strokeWidth='0.5'
        />
        <line
          x1='38'
          y1='0'
          x2='44'
          y2='0'
          stroke='rgba(255,255,255,0.15)'
          strokeWidth='0.5'
        />
        <line
          x1='0'
          y1='-44'
          x2='0'
          y2='-38'
          stroke='rgba(255,255,255,0.15)'
          strokeWidth='0.5'
        />
        <line
          x1='0'
          y1='38'
          x2='0'
          y2='44'
          stroke='rgba(255,255,255,0.15)'
          strokeWidth='0.5'
        />

        {/* Main circle */}
        <circle
          r='36'
          fill='rgba(255,255,255,0.03)'
          stroke='rgba(255,255,255,0.2)'
          strokeWidth='1'
        />

        {/* Inner ring */}
        <circle
          r='28'
          fill='none'
          stroke='rgba(255,255,255,0.06)'
          strokeWidth='0.5'
          strokeDasharray='2 4'
        />

        {/* Label */}
        <text
          textAnchor='middle'
          y='4'
          fill='rgba(255,255,255,0.85)'
          fontSize='11'
          className='node-label'
        >
          Client
        </text>

        {/* Status */}
        <g transform='translate(0,60)'>
          <circle
            cx='-18'
            cy='0'
            r='2'
            fill='rgba(255,255,255,0.5)'
            className='status-dot'
          />
          <text
            x='-10'
            y='3'
            fill='rgba(255,255,255,0.3)'
            fontSize='9'
            fontFamily='monospace'
            letterSpacing='0.05em'
          >
            ENCRYPT
          </text>
        </g>
      </g>

      {/* ==================== SERVER NODE ==================== */}
      <g transform='translate(450,120)'>
        {/* Pulse ring */}
        <circle
          r='36'
          fill='none'
          stroke='rgba(255,255,255,0.15)'
          strokeWidth='0.5'
        >
          <animate
            attributeName='r'
            values='36;56'
            dur='3s'
            begin='1s'
            repeatCount='indefinite'
          />
          <animate
            attributeName='opacity'
            values='0.3;0'
            dur='3s'
            begin='1s'
            repeatCount='indefinite'
          />
        </circle>

        {/* Crosshair marks */}
        <line
          x1='-44'
          y1='0'
          x2='-38'
          y2='0'
          stroke='rgba(255,255,255,0.15)'
          strokeWidth='0.5'
        />
        <line
          x1='38'
          y1='0'
          x2='44'
          y2='0'
          stroke='rgba(255,255,255,0.15)'
          strokeWidth='0.5'
        />
        <line
          x1='0'
          y1='-44'
          x2='0'
          y2='-38'
          stroke='rgba(255,255,255,0.15)'
          strokeWidth='0.5'
        />
        <line
          x1='0'
          y1='38'
          x2='0'
          y2='44'
          stroke='rgba(255,255,255,0.15)'
          strokeWidth='0.5'
        />

        {/* Main circle */}
        <circle
          r='36'
          fill='rgba(255,255,255,0.03)'
          stroke='rgba(255,255,255,0.25)'
          strokeWidth='1'
        />

        {/* Inner ring */}
        <circle
          r='28'
          fill='none'
          stroke='rgba(255,255,255,0.06)'
          strokeWidth='0.5'
          strokeDasharray='2 4'
        />

        {/* Lock icon — refined */}
        <rect
          x='-5'
          y='-2'
          width='10'
          height='8'
          rx='1.5'
          fill='rgba(255,255,255,0.15)'
          stroke='rgba(255,255,255,0.5)'
          strokeWidth='0.8'
        />
        <path
          d='M-2.5,-2 L-2.5,-6 A2.5,2.5 0 0,1 2.5,-6 L2.5,-2'
          fill='none'
          stroke='rgba(255,255,255,0.5)'
          strokeWidth='0.8'
        />
        <circle cx='0' cy='2' r='1' fill='rgba(255,255,255,0.4)' />

        {/* Label */}
        <text
          textAnchor='middle'
          y='18'
          fill='rgba(255,255,255,0.85)'
          fontSize='11'
          className='node-label'
        >
          Capsule
        </text>

        {/* Status */}
        <g transform='translate(0,60)'>
          <circle
            cx='-18'
            cy='0'
            r='2'
            fill='rgba(255,255,255,0.5)'
            className='status-dot'
          />
          <text
            x='-10'
            y='3'
            fill='rgba(255,255,255,0.3)'
            fontSize='9'
            fontFamily='monospace'
            letterSpacing='0.05em'
          >
            PROCESS
          </text>
        </g>
      </g>

      {/* ==================== AI NODE ==================== */}
      <g transform='translate(750,180)'>
        {/* Pulse ring */}
        <circle
          r='36'
          fill='none'
          stroke='rgba(255,255,255,0.15)'
          strokeWidth='0.5'
        >
          <animate
            attributeName='r'
            values='36;56'
            dur='3s'
            begin='2s'
            repeatCount='indefinite'
          />
          <animate
            attributeName='opacity'
            values='0.3;0'
            dur='3s'
            begin='2s'
            repeatCount='indefinite'
          />
        </circle>

        {/* Crosshair marks */}
        <line
          x1='-44'
          y1='0'
          x2='-38'
          y2='0'
          stroke='rgba(255,255,255,0.15)'
          strokeWidth='0.5'
        />
        <line
          x1='38'
          y1='0'
          x2='44'
          y2='0'
          stroke='rgba(255,255,255,0.15)'
          strokeWidth='0.5'
        />
        <line
          x1='0'
          y1='-44'
          x2='0'
          y2='-38'
          stroke='rgba(255,255,255,0.15)'
          strokeWidth='0.5'
        />
        <line
          x1='0'
          y1='38'
          x2='0'
          y2='44'
          stroke='rgba(255,255,255,0.15)'
          strokeWidth='0.5'
        />

        {/* Main circle */}
        <circle
          r='36'
          fill='rgba(255,255,255,0.03)'
          stroke='rgba(255,255,255,0.2)'
          strokeWidth='1'
        />

        {/* Inner ring */}
        <circle
          r='28'
          fill='none'
          stroke='rgba(255,255,255,0.06)'
          strokeWidth='0.5'
          strokeDasharray='2 4'
        />

        {/* Label */}
        <text
          textAnchor='middle'
          y='4'
          fill='rgba(255,255,255,0.85)'
          fontSize='11'
          className='node-label'
        >
          AI
        </text>

        {/* Status */}
        <g transform='translate(0,60)'>
          <circle
            cx='-20'
            cy='0'
            r='2'
            fill='rgba(255,255,255,0.5)'
            className='status-dot'
          />
          <text
            x='-12'
            y='3'
            fill='rgba(255,255,255,0.3)'
            fontSize='9'
            fontFamily='monospace'
            letterSpacing='0.05em'
          >
            RESPOND
          </text>
        </g>
      </g>

      {/* Midpoint labels on path */}
      <text
        x='290'
        y='145'
        fill='rgba(255,255,255,0.12)'
        fontSize='7'
        fontFamily='monospace'
        letterSpacing='0.1em'
      >
        TLS 1.3
      </text>
      <text
        x='590'
        y='145'
        fill='rgba(255,255,255,0.12)'
        fontSize='7'
        fontFamily='monospace'
        letterSpacing='0.1em'
      >
        AES-256
      </text>
    </svg>
  );
}

export default EncryptionFlowIllustration;
