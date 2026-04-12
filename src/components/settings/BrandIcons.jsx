export const ClaudeSunburst = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <line x1="12" y1="2" x2="12" y2="7" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
    <line x1="12" y1="17" x2="12" y2="22" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
    <line x1="2" y1="12" x2="7" y2="12" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
    <line x1="17" y1="12" x2="22" y2="12" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
    <line x1="4.93" y1="4.93" x2="8.46" y2="8.46" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
    <line x1="15.54" y1="15.54" x2="19.07" y2="19.07" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
    <line x1="4.93" y1="19.07" x2="8.46" y2="15.54" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
    <line x1="15.54" y1="8.46" x2="19.07" y2="4.93" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
    <circle cx="12" cy="12" r="2" fill="white"/>
  </svg>
);

export const CodexCloud = ({ size = 28 }) => (
  <svg width={size} height={size * 0.78} viewBox="0 0 32 26" fill="none">
    <ellipse cx="16" cy="16" rx="12" ry="9" fill="rgba(255,255,255,0.25)"/>
    <ellipse cx="11" cy="13" rx="8" ry="8" fill="rgba(255,255,255,0.25)"/>
    <ellipse cx="21" cy="13" rx="8" ry="8" fill="rgba(255,255,255,0.25)"/>
    <ellipse cx="16" cy="10" rx="9" ry="7" fill="rgba(255,255,255,0.3)"/>
  </svg>
);

export const OpenAIIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="rgba(255,255,255,0.7)">
    <path d="M22.282 9.821a5.985 5.985 0 00-.516-4.91 6.046 6.046 0 00-6.51-2.9A6.065 6.065 0 0011.5.5a6.04 6.04 0 00-5.753 4.218 5.97 5.97 0 00-3.997 2.9 6.05 6.05 0 00.754 7.09 5.98 5.98 0 00.516 4.911 6.05 6.05 0 006.51 2.9A6.04 6.04 0 0013.5 23.5a6.04 6.04 0 005.753-4.218 5.97 5.97 0 003.997-2.9 6.04 6.04 0 00-.968-6.561z"/>
  </svg>
);

export const GoogleIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

export const GroqIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" fill="#F47834"/>
  </svg>
);

export const GmailIcon = ({ size = 18 }) => (
  <svg width={size} height={size * 0.78} viewBox="0 0 24 18" fill="none">
    <path d="M1.636 18h4.364V8.727L0 5.455V16.36c0 .905.731 1.636 1.636 1.636z" fill="#4285F4"/>
    <path d="M18 18h4.364c.905 0 1.636-.731 1.636-1.636V5.455L18 8.727z" fill="#34A853"/>
    <path d="M18 1.636V8.727l6-3.272V3.273c0-2.024-2.312-3.178-3.927-1.964z" fill="#FBBC05"/>
    <path d="M6 8.727V1.636l6 4.91 6-4.91v7.09l-6 4.91z" fill="#EA4335"/>
    <path d="M0 3.273v2.182l6 3.273V1.636L3.927 1.31C2.312-.096 0 1.25 0 3.273z" fill="#C5221F"/>
  </svg>
);

export const CalendarIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="4" width="18" height="18" rx="2" stroke="#4285F4" strokeWidth="2" fill="none"/>
    <path d="M3 10h18" stroke="#4285F4" strokeWidth="2"/>
    <path d="M8 2v4M16 2v4" stroke="#4285F4" strokeWidth="2" strokeLinecap="round"/>
    <rect x="7" y="13" width="3" height="3" rx="0.5" fill="#34A853"/>
    <rect x="14" y="13" width="3" height="3" rx="0.5" fill="#EA4335"/>
  </svg>
);

export const DriveIcon = ({ size = 18 }) => (
  <svg width={size} height={size * 0.89} viewBox="0 0 24 22" fill="none">
    <path d="M8.24 1L1 14l3.56 6.16L11.8 7.16z" fill="#0066DA"/>
    <path d="M15.76 1H8.24l7.24 13.16h7.52z" fill="#00AC47"/>
    <path d="M23 14.16h-7.24L12.2 20.32h7.24z" fill="#EA4335"/>
    <path d="M4.56 20.16L8.12 14H1z" fill="#00832D"/>
    <path d="M15.76 14l3.56 6.16L23 14.16z" fill="#2684FC"/>
    <path d="M8.24 1l7.52 13.16H8.12L4.56 20.16l7.24-13z" fill="#FFBA00"/>
  </svg>
);

export const AppleIcon = ({ size = 16 }) => (
  <svg width={size} height={size * 1.125} viewBox="0 0 24 24" fill="rgba(255,255,255,0.7)">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
  </svg>
);

export const PandaDocIcon = ({ size = 38 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64">
    <path d="M62.125 0H1.875C.84 0 0 .84 0 1.875v60.25C0 63.16.84 64 1.875 64h60.25C63.16 64 64 63.16 64 62.125V1.875C64 .84 63.16 0 62.125 0z" fill="#248567"/>
    <path d="M48.123 11.37V23.25c-1.92-1.525-4.35-2.436-6.992-2.436-3.737 0-7.048 1.823-9.094 4.627a11.2 11.2 0 0 0-2.157 6.625c0 .013-.005.005-.015-.015-.006 3.857-3.134 6.982-6.992 6.982-3.853 0-6.977-3.116-6.992-6.966v-.053c.014-3.85 3.14-6.966 6.992-6.966 2.62 0 4.904 1.443 6.1 3.577.142-.48.473-1.512.937-2.42.403-.788.922-1.47 1.207-1.82a11.22 11.22 0 0 0-8.245-3.597c-6.14 0-11.132 4.92-11.25 11.033h-.01v20.912h4.267V40.855c1.92 1.525 4.35 2.436 6.99 2.436 3.753 0 7.076-1.838 9.12-4.662 1.334-1.836 2.116-4.1 2.116-6.546 0-.02.012.004.032.058 0-.026-.002-.05-.002-.077 0-3.862 3.13-6.992 6.992-6.992 3.852 0 6.976 3.115 6.992 6.963v.058c-.016 3.848-3.14 6.963-6.992 6.963-2.622 0-4.906-1.444-6.103-3.58-.134.458-.47 1.528-.95 2.467-.39.765-.89 1.43-1.18 1.787a11.22 11.22 0 0 0 8.234 3.586c6.14 0 11.132-4.92 11.25-11.033h.01V11.37z" fill="#fff"/>
  </svg>
);

export const PipedriveIcon = ({ size = 38 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.21,
      background: "#000000",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <span
      style={{
        color: "white",
        fontSize: size * 0.58,
        fontWeight: 700,
        fontFamily: "-apple-system, system-ui, sans-serif",
        lineHeight: 1,
        marginTop: size * -0.1,
      }}
    >
      p
    </span>
  </div>
);

export const ICON_BG = {
  claude:      "bg-[#D97757]",
  claudeCode:  "bg-[#D97757]",
  codex:       "bg-gradient-to-br from-[#7B6BF0] via-[#5B8DEF] to-[#9B7BF7]",
  google:      "bg-blue-500/10",
  groq:        "bg-orange-500/10",
  gmail:       "bg-red-500/10",
  gcal:        "bg-blue-500/10",
  drive:       "bg-yellow-500/10",
  apple:       "bg-white/[0.06]",
  pandadoc:    "",
  pipedrive:   "",
};
