import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export default function Barcode({ value, className = "" }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;
    try {
      JsBarcode(svgRef.current, String(value), {
        format: "CODE128",
        displayValue: false,
        lineColor: "#111827",
        width: 1,
        height: 40,
        margin: 0,
      });
    } catch (err) {
      console.error("Failed to render barcode:", err);
    }
  }, [value]);

  return (
    <svg
      ref={svgRef}
      className={className}
    />
  );
}

