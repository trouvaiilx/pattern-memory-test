"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Check,
  X,
  RotateCcw,
  Download,
  AlertCircle,
  Activity,
} from "lucide-react";

// Total valid Android patterns (calculated: patterns of length 4-9)
const TOTAL_PATTERNS = 389112;

// Pattern encoding: Each dot is numbered 0-8 (top-left to bottom-right)
// Pattern stored as string like "0-1-2" for top row swipe
const PatternTester = () => {
  const [invalidPatterns, setInvalidPatterns] = useState<Set<string>>(
    new Set()
  );
  const [currentPattern, setCurrentPattern] = useState<number[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [awaitingValidation, setAwaitingValidation] = useState(false);
  const [validationResult, setValidationResult] = useState<
    "invalid" | "valid" | "duplicate" | null
  >(null);
  const [stats, setStats] = useState({ tested: 0, invalid: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<(HTMLDivElement | null)[]>([]);
  const [touchPos, setTouchPos] = useState<{ x: number; y: number } | null>(
    null
  );

  // Load saved patterns on mount
  useEffect(() => {
    const saved = localStorage.getItem("invalidPatterns");
    if (saved) {
      const parsed = JSON.parse(saved);
      setInvalidPatterns(new Set(parsed));
      setStats({
        tested: parsed.length,
        invalid: parsed.length,
      });
    }
  }, []);

  // Save patterns whenever they change
  useEffect(() => {
    if (invalidPatterns.size > 0) {
      localStorage.setItem(
        "invalidPatterns",
        JSON.stringify([...invalidPatterns])
      );
    }
  }, [invalidPatterns]);

  // Encode pattern as string
  const encodePattern = (pattern: number[]) => pattern.join("-");

  // Get middle dot between two dots (for auto-include rule)
  const getMiddleDot = (a: number, b: number) => {
    const row1 = Math.floor(a / 3);
    const col1 = a % 3;
    const row2 = Math.floor(b / 3);
    const col2 = b % 3;

    // Check if dots are on same row/col/diagonal with a gap
    if (Math.abs(row2 - row1) === 2 && col1 === col2) {
      return row1 + 1 + col1 * 3; // Vertical skip
    }
    if (Math.abs(col2 - col1) === 2 && row1 === row2) {
      return row1 * 3 + col1 + 1; // Horizontal skip
    }
    if (Math.abs(row2 - row1) === 2 && Math.abs(col2 - col1) === 2) {
      return 4; // Center diagonal skip
    }
    return null;
  };

  // Add dot to pattern with Android rules
  const addDotToPattern = (dotIndex: number) => {
    if (currentPattern.includes(dotIndex)) return currentPattern;

    const newPattern = [...currentPattern];

    // Auto-include skipped middle dot
    if (newPattern.length > 0) {
      const lastDot = newPattern[newPattern.length - 1];
      const middleDot = getMiddleDot(lastDot, dotIndex);

      if (middleDot !== null && !newPattern.includes(middleDot)) {
        newPattern.push(middleDot);
      }
    }

    newPattern.push(dotIndex);
    return newPattern;
  };

  // Get dot position from touch/mouse event
  const getDotFromPosition = (x: number, y: number) => {
    for (let i = 0; i < dotsRef.current.length; i++) {
      const dot = dotsRef.current[i];
      if (!dot) continue;

      const rect = dot.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);

      // Increased tolerance for smaller dots (was 20)
      if (distance < 40) return i;
    }
    return null;
  };

  // Handle pattern start
  const handleStart = (e: React.PointerEvent) => {
    e.preventDefault();
    const dotIndex = getDotFromPosition(e.clientX, e.clientY);

    if (dotIndex !== null) {
      // Allow reinput even when awaiting validation
      setIsDrawing(true);
      setCurrentPattern([dotIndex]);
      setValidationResult(null);
      setAwaitingValidation(false);

      // Capture pointer for global dragging
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  // Handle pattern drawing
  const handleMove = (e: React.PointerEvent) => {
    e.preventDefault();
    if (!isDrawing) return;

    setTouchPos({ x: e.clientX, y: e.clientY });

    const dotIndex = getDotFromPosition(e.clientX, e.clientY);
    if (dotIndex !== null && !currentPattern.includes(dotIndex)) {
      setCurrentPattern(addDotToPattern(dotIndex));

      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(10);
      }
    }
  };

  // Handle pattern end
  const handleEnd = () => {
    if (!isDrawing) return;

    setIsDrawing(false);
    setTouchPos(null);

    if (currentPattern.length >= 4) {
      const encoded = encodePattern(currentPattern);

      // Check if already tested
      if (invalidPatterns.has(encoded)) {
        setValidationResult("duplicate");
        setTimeout(() => {
          setCurrentPattern([]);
          setValidationResult(null);
        }, 1500);
      } else {
        setAwaitingValidation(true);
      }
    } else {
      setCurrentPattern([]);
    }
  };

  // Mark pattern as invalid
  const markInvalid = () => {
    const encoded = encodePattern(currentPattern);
    setInvalidPatterns((prev) => new Set([...prev, encoded]));
    setStats((prev) => ({
      tested: prev.tested + 1,
      invalid: prev.invalid + 1,
    }));
    setValidationResult("invalid");
    setAwaitingValidation(false);

    setTimeout(() => {
      setCurrentPattern([]);
      setValidationResult(null);
    }, 1500);
  };

  // Mark pattern as valid (correct!)
  const markValid = () => {
    setStats((prev) => ({ ...prev, tested: prev.tested + 1 }));
    setValidationResult("valid");
    setAwaitingValidation(false);
  };

  // Reset all data
  const resetAll = () => {
    if (confirm("Delete all saved patterns? This cannot be undone.")) {
      localStorage.removeItem("invalidPatterns");
      setInvalidPatterns(new Set());
      setStats({ tested: 0, invalid: 0 });
      setCurrentPattern([]);
      setAwaitingValidation(false);
      setValidationResult(null);
    }
  };

  // Handle clicking empty space to dismiss
  const handleBackgroundClick = (e: React.MouseEvent) => {
    // Only dismiss if we have a pattern or result
    if (currentPattern.length > 0 || validationResult) {
      setCurrentPattern([]);
      setValidationResult(null);
      setAwaitingValidation(false);
    }
  };

  // Export patterns
  const exportData = () => {
    const data = {
      invalidPatterns: [...invalidPatterns],
      stats,
      exportDate: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pattern-memory-${Date.now()}.json`;
    a.click();
  };

  // Draw canvas lines
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (currentPattern.length === 0) return;

    // Draw lines between dots
    ctx.strokeStyle =
      validationResult === "invalid"
        ? "#ef4444"
        : validationResult === "valid"
        ? "#22c55e"
        : validationResult === "duplicate"
        ? "#f59e0b"
        : "#1f2937";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();

    currentPattern.forEach((dotIndex, i) => {
      const dot = dotsRef.current[dotIndex];
      if (!dot) return;

      const dotRect = dot.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      const x = dotRect.left - canvasRect.left + dotRect.width / 2;
      const y = dotRect.top - canvasRect.top + dotRect.height / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    // Draw line to current touch position if drawing
    if (isDrawing && touchPos && currentPattern.length > 0) {
      const canvasRect = canvas.getBoundingClientRect();
      ctx.lineTo(touchPos.x - canvasRect.left, touchPos.y - canvasRect.top);
    }

    ctx.stroke();
  }, [currentPattern, isDrawing, touchPos, validationResult]);

  const remaining = TOTAL_PATTERNS - invalidPatterns.size;

  return (
    <div
      className="h-screen bg-white text-gray-900 p-4 flex flex-col"
      onClick={handleBackgroundClick}
    >
      <div className="w-full max-w-md mx-auto flex flex-col h-full">
        {/* Top Section: Header & Stats - Stable Height */}
        <div className="flex-none">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold mb-2">Pattern Memory Test</h1>
            <p className="text-gray-600 text-sm">
              Test patterns systematically to find your forgotten lock
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">
                {stats.tested}
              </div>
              <div className="text-xs text-gray-600">Tested</div>
            </div>
            <div className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">
                {stats.invalid}
              </div>
              <div className="text-xs text-gray-600">Invalid</div>
            </div>
            <div className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">
                {remaining.toLocaleString()}
              </div>
              <div className="text-xs text-gray-600">Remaining</div>
            </div>
          </div>
        </div>

        {/* Middle Section: Grid - Flex Grow to take available space */}
        <div className="flex-grow flex flex-col justify-center items-center min-h-0">
          <div className="relative touch-none select-none py-8">
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ touchAction: "none" }}
            />

            <div
              className="grid grid-cols-3 gap-8 md:gap-12 relative z-10"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => {
                e.preventDefault(); // Stop default touch actions
                e.stopPropagation(); // Prevent dismissing when starting to draw
                handleStart(e);
              }}
              onPointerMove={handleMove}
              onPointerUp={handleEnd}
              onPointerLeave={handleEnd}
            >
              {[...Array(9)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-center w-16 h-16"
                >
                  <div
                    ref={(el) => {
                      dotsRef.current[i] = el;
                    }}
                    className={`w-3 h-3 rounded-full transition-all duration-200 border-2 ${
                      currentPattern.includes(i)
                        ? validationResult === "invalid"
                          ? "bg-red-500 border-red-600 scale-150"
                          : validationResult === "valid"
                          ? "bg-green-500 border-green-600 scale-150"
                          : validationResult === "duplicate"
                          ? "bg-yellow-500 border-yellow-600 scale-150"
                          : "bg-gray-900 border-gray-900 scale-150"
                        : "bg-white border-gray-400 scale-100"
                    }`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Section: Controls & Feedback - Fixed Min Height */}
        <div
          className="flex-none h-[260px] flex flex-col justify-end pb-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Status Messages */}
          {validationResult === "duplicate" && (
            <div className="bg-yellow-50 border border-yellow-400 rounded-lg p-4 mb-4 flex items-center gap-3">
              <AlertCircle className="text-yellow-600" size={24} />
              <div>
                <div className="font-semibold text-gray-900">
                  Already Tested
                </div>
                <div className="text-sm text-gray-700">
                  You've marked this pattern as incorrect before
                </div>
              </div>
            </div>
          )}

          {validationResult === "valid" && (
            <div className="bg-green-50 border border-green-500 rounded-lg p-4 mb-4 flex items-center gap-3">
              <Check className="text-green-600" size={24} />
              <div>
                <div className="font-semibold text-gray-900">
                  Pattern Found!
                </div>
                <div className="text-sm text-gray-700">
                  This is your correct pattern
                </div>
              </div>
            </div>
          )}

          {validationResult === "invalid" && (
            <div className="bg-red-50 border border-red-500 rounded-lg p-4 mb-4 flex items-center gap-3">
              <X className="text-red-600" size={24} />
              <div>
                <div className="font-semibold text-gray-900">
                  Pattern Marked Invalid
                </div>
                <div className="text-sm text-gray-700">
                  This pattern won't be suggested again
                </div>
              </div>
            </div>
          )}

          {/* Validation Buttons */}
          {awaitingValidation && (
            <div className="bg-gray-100 border border-gray-300 rounded-lg p-6 mb-4">
              <div className="text-center mb-4 font-semibold text-gray-900">
                Is this your correct pattern?
              </div>
              <div className="text-center mb-4 text-sm text-gray-600">
                Hold any dot to draw again
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    markInvalid();
                  }}
                  className="bg-red-600 hover:bg-red-700 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition text-white"
                >
                  <X size={20} /> No
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    markValid();
                  }}
                  className="bg-green-600 hover:bg-green-700 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition text-white"
                >
                  <Check size={20} /> Yes
                </button>
              </div>
            </div>
          )}

          {/* Instructions */}
          {!awaitingValidation && currentPattern.length === 0 && (
            <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 mb-4 text-sm text-gray-700">
              <Activity className="inline mr-2 text-gray-900" size={16} />
              Draw a pattern by connecting at least 4 dots. Release to test.
            </div>
          )}

          {/* Controls */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                exportData();
              }}
              disabled={invalidPatterns.size === 0}
              className="bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 border border-gray-300 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition text-gray-900"
            >
              <Download size={18} /> Export
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                resetAll();
              }}
              disabled={invalidPatterns.size === 0}
              className="bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 border border-gray-300 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition text-gray-900"
            >
              <RotateCcw size={18} /> Reset
            </button>
          </div>

          {/* Privacy Notice */}
          <div className="mt-6 text-center text-xs text-gray-500">
            All patterns are stored locally on your device only.
            <br />
            No data is ever uploaded or shared.
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatternTester;
