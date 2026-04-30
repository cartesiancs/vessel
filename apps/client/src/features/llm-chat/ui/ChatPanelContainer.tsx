import { useIsMobile } from "@/shared/lib/hooks/use-mobile";
import { useChatStore } from "../model/store";
import { useChatKeyboard } from "../model/useChatKeyboard";
import { ChatPanel } from "./ChatPanel";
import { ChatPanelMobile } from "./ChatPanelMobile";

export function ChatPanelContainer() {
  const isMobile = useIsMobile();
  const isOpen = useChatStore((s) => s.isOpen);

  // Cmd+K 단축키 등록
  useChatKeyboard();

  // 모바일에서는 열려있을 때만 Sheet 표시
  if (isMobile) {
    return isOpen ? <ChatPanelMobile /> : null;
  }

  // 데스크톱에서는 항상 패널 렌더링 (열기/닫기 애니메이션 처리)
  return <ChatPanel />;
}
