import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { useLocation, useNavigate } from "react-router";

export function TopBar({ hide = false }: { hide?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [canBack, setCanBack] = useState(false);
  const [canForward, setCanForward] = useState(false);

  useEffect(() => {
    const idx = window.history.state?.idx ?? 0;
    const length = window.history.length;
    setCanBack(idx > 0);
    setCanForward(idx < length - 2);
  }, [location]);

  return (
    <div
      className="
        fixed top-0 left-0 w-full h-[34px]
        bg-[oklch(0.145_0_0)] border-b-[0.75px] border-[#3a3f44]
        flex items-center justify-center z-[999]
        [-webkit-app-region:drag]
      "
    >
      {!hide && (
        <>
          <button
            onClick={() => navigate(-1)}
            disabled={!canBack}
            className="
          flex items-center justify-center h-full p-1
          [-webkit-app-region:no-drag]
          disabled:opacity-50 disabled:cursor-not-allowed
        "
          >
            <ArrowLeft size={14} />
          </button>
          <button
            onClick={() => {
              navigate(1);
            }}
            disabled={!canForward}
            className="
          flex items-center justify-center h-full p-1 ml-2
          [-webkit-app-region:no-drag]
          disabled:opacity-50 disabled:cursor-not-allowed
        "
          >
            <ArrowRight size={14} />
          </button>
          <span className="text-xs text-gray-400 mx-2 mx-[16px]">Vessel</span>
          <button
            onClick={() => {
              window.location.reload();
            }}
            className="
          flex items-center justify-center h-full p-1 ml-2
          [-webkit-app-region:no-drag]
          disabled:opacity-50 disabled:cursor-not-allowed
        "
          >
            <RotateCcw size={14} />
          </button>
        </>
      )}
    </div>
  );
}
