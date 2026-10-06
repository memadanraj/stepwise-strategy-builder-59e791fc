import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { provisionStripePrices } from "@/lib/stripe-provision.functions";

export const Route = createFileRoute("/dev-provision")({
  component: DevProvision,
});

function DevProvision() {
  const [output, setOutput] = useState("Running…");
  useEffect(() => {
    provisionStripePrices()
      .then((r) => setOutput(JSON.stringify(r, null, 2)))
      .catch((e) => setOutput(`ERROR: ${e?.message || String(e)}`));
  }, []);
  return (
    <pre id="provision-result" style={{ padding: 24, fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
      {output}
    </pre>
  );
}
