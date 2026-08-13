"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

function VerifyContent() {
  const { verifyOtp, loginUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [username, setUsername] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendStatus, setResendStatus] = useState("");
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    const userParam = searchParams?.get("username");
    if (userParam) {
      setUsername(userParam);
    } else {
      router.push("/auth/register");
    }
  }, [searchParams, router]);

  const handleChange = (element: HTMLInputElement, index: number) => {
    const value = element.value.replace(/[^0-9]/g, "");
    if (!value) return;

    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);

    // Focus next input
    if (value && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace") {
      const newOtp = [...otp];
      newOtp[index] = "";
      setOtp(newOtp);
      
      // Focus previous input
      if (index > 0 && inputRefs.current[index - 1]) {
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResendStatus("");
    
    const otpCode = otp.join("");
    if (otpCode.length < 6) {
      setError("Please enter the full 6-digit verification code");
      return;
    }

    setLoading(true);
    try {
      await verifyOtp(username, otpCode);
    } catch (err: any) {
      setError(err.message || "Invalid verification code. Try '123456'.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setResendStatus("");
    try {
      await loginUser(username);
      setResendStatus("Code resent successfully! Hint: Use 123456");
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      setError(err.message || "Failed to resend code");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        <div className="flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600/10 text-blue-500 shadow-md">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-8 w-8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
              />
            </svg>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold tracking-tight text-white">
            Enter Verification Code
          </h2>
          <p className="mt-2 text-center text-sm text-slate-400">
            We sent a verification code to <span className="font-semibold text-slate-200">{username}</span>
          </p>
          <span className="mt-1 text-[11px] text-blue-500 font-medium">Hint: Enter 123456</span>
        </div>

        {error && (
          <div className="rounded-lg bg-red-950/30 border border-red-500/30 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {resendStatus && (
          <div className="rounded-lg bg-green-950/30 border border-green-500/30 p-3 text-sm text-green-400">
            {resendStatus}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {/* OTP Code Grids */}
          <div className="flex justify-between gap-2">
            {otp.map((data, index) => (
              <input
                key={index}
                type="text"
                maxLength={1}
                value={data}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                onChange={(e) => handleChange(e.target, index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                className="h-12 w-12 rounded-lg border border-slate-800 bg-slate-950 text-center text-xl font-bold text-white outline-none focus:border-blue-600 transition-colors"
              />
            ))}
          </div>

          <div className="space-y-3">
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-blue-500 active:scale-95 disabled:bg-blue-800 disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify Code"}
            </button>

            <button
              type="button"
              onClick={handleResend}
              className="flex w-full justify-center text-xs font-semibold text-slate-400 hover:text-white py-1 transition-colors"
            >
              Resend Code
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Verify() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <svg className="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    }>
      <VerifyContent />
    </Suspense>
  );
}
