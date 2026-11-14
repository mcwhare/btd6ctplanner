import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const root = createRoot(document.getElementById("root"));

function Failure({ error }) {
  return (
    <div className="max-w-3xl p-6">
      <h2 className="mb-2 font-display text-xl font-bold">Something went wrong</h2>
      <p>{String(error?.message ?? error)}</p>
      <pre className="mt-3 text-xs whitespace-pre-wrap opacity-80">{String(error?.stack ?? "")}</pre>
    </div>
  );
}

class Boundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() { return this.state.error ? <Failure error={this.state.error} /> : this.props.children; }
}

// Load App dynamically so a broken import (e.g. a missing file) is shown here instead of a blank page.
import("./App.jsx")
  .then(({ default: App }) => root.render(<Boundary><App /></Boundary>))
  .catch((error) => root.render(<Failure error={error} />));