
  import { Component, type ErrorInfo, type ReactNode } from "react";
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean; detail: string }> {
    state = { failed: false, detail: "" };

    static getDerivedStateFromError(error: Error) {
      return { failed: true, detail: error?.message || "UNKNOWN_RUNTIME_ERROR" };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
      console.error("TripFlow runtime error", error, info);
    }

    render() {
      if (!this.state.failed) return this.props.children;
      return (
        <main className="min-h-screen bg-[#F7F4EF] px-6 flex items-center justify-center text-[#2B2924]">
          <section className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-lg text-center">
            <h1 className="text-xl font-bold">页面加载失败</h1>
            <p className="mt-3 text-sm leading-relaxed text-[#777269]">可能是旧版本数据或临时加载异常。可以先重新加载；如仍失败，再恢复示例数据。</p>
            <p className="mt-3 rounded-xl bg-[#F7F4EF] px-3 py-2 text-left text-xs break-all text-[#C96B58]">错误信息：{this.state.detail}</p>
            <button className="mt-6 h-11 w-full rounded-2xl bg-[#F8DF72] font-semibold" onClick={() => window.location.reload()}>重新加载</button>
            <button className="mt-3 h-11 w-full rounded-2xl border border-[#EEE9DC] text-sm" onClick={() => {
              if (!window.confirm("恢复示例数据会清除当前浏览器内保存的行程，确定继续吗？")) return;
              window.localStorage.removeItem("tripflow.app-data");
              window.location.reload();
            }}>恢复示例数据</button>
          </section>
        </main>
      );
    }
  }

  createRoot(document.getElementById("root")!).render(<AppErrorBoundary><App /></AppErrorBoundary>);
