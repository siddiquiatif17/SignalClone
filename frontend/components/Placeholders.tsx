"use client";

import React from "react";

export function CallsPlaceholder() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-950 dark:bg-slate-950 text-slate-100 dark:text-slate-100">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-600/10 text-blue-500">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-2.824-1.502-5.114-3.792-6.615-6.615l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H3.75A2.25 2.25 0 001.5 4.5v2.25z" />
        </svg>
      </div>
      <h3 className="text-md font-bold tracking-tight text-slate-200">Voice & Video Calls</h3>
      <p className="mt-1 max-w-xs text-xs text-slate-500">
        Secure, high-quality audio and video calling is coming soon.
      </p>
    </div>
  );
}

export function StoriesPlaceholder() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-950 dark:bg-slate-950 text-slate-100 dark:text-slate-100">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-600/10 text-blue-500">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
        </svg>
      </div>
      <h3 className="text-md font-bold tracking-tight text-slate-200">Stories Updates</h3>
      <p className="mt-1 max-w-xs text-xs text-slate-500">
        Share end-to-end encrypted updates with your contacts that disappear after 24 hours. Coming soon!
      </p>
    </div>
  );
}

export function DevicesPlaceholder() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-950 dark:bg-slate-950 text-slate-100 dark:text-slate-100">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-600/10 text-blue-500">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
        </svg>
      </div>
      <h3 className="text-md font-bold tracking-tight text-slate-200">Linked Devices</h3>
      <p className="mt-1 max-w-xs text-xs text-slate-500">
        Link Signal to your iPad, computer, or other devices to message securely from anywhere. Coming soon!
      </p>
    </div>
  );
}
