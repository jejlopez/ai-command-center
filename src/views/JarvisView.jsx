import { JarvisChat } from "../components/jarvis/JarvisChat.jsx";
import { DisplayPanel } from "../components/jarvis/DisplayPanel.jsx";
import { useDisplay } from "../hooks/useDisplay.js";
import { useJarvisData } from "../hooks/useJarvisData.js";

export default function JarvisView() {
  const { displayState, pushDisplay, goBack, history } = useDisplay();
  const { data } = useJarvisData();

  return (
    <div className="h-full flex">
      {/* Left: Conversation */}
      <div className="w-[420px] shrink-0 border-r border-jarvis-border">
        <JarvisChat onDisplayUpdate={pushDisplay} />
      </div>

      {/* Right: Live Display */}
      <div className="flex-1 min-w-0">
        <DisplayPanel
          displayState={displayState}
          data={data}
          onBack={goBack}
          history={history}
        />
      </div>
    </div>
  );
}
