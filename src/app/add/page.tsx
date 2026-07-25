"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, Plus, Trash2, CheckCircle2, AlertTriangle, Send, 
  User, Calendar, BookOpen, Compass, Sun, Moon, HelpCircle
} from "lucide-react";

export default function AddReview() {
  const [proctorId, setProctorId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [vivaDate, setVivaDate] = useState("");
  const [questions, setQuestions] = useState<string[]>([""]);
  const [suggestions, setSuggestions] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Sync theme
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark";
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle("dark", savedTheme === "dark");
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
  };

  useEffect(() => {
    const appsScriptUrl = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;
    if (!appsScriptUrl) {
      setIsOfflineMode(true);
    }
  }, []);

  const handleAddQuestionField = () => {
    setQuestions([...questions, ""]);
  };

  const handleQuestionChange = (index: number, value: string) => {
    const updated = [...questions];
    updated[index] = value;
    setQuestions(updated);
  };

  const handleRemoveQuestionField = (index: number) => {
    if (questions.length === 1) return;
    const updated = questions.filter((_, idx) => idx !== index);
    setQuestions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proctorId.trim()) {
      setErrorMessage("Proctor ID is required.");
      setSubmitStatus("error");
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus("idle");
    setErrorMessage("");

    const cleanQuestions = questions.filter((q) => q.trim().length > 0);
    const normalizedProctorId = proctorId.trim().replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

    const payload = {
      id: Date.now(),
      studentName: studentName.trim() || "Anonymous Student",
      vivaDate: vivaDate.trim() || new Date().toLocaleDateString(),
      submissionDate: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      rawTimestamp: Date.now() / (1000 * 60 * 60 * 24) + 25569,
      proctorId: proctorId.trim(),
      normalizedProctorId: normalizedProctorId,
      questions: cleanQuestions,
      suggestions: suggestions.trim(),
    };

    if (isOfflineMode) {
      setTimeout(() => {
        try {
          const localReviewsStr = localStorage.getItem("local_viva_reviews");
          const localReviews = localReviewsStr ? JSON.parse(localReviewsStr) : [];
          localReviews.push(payload);
          localStorage.setItem("local_viva_reviews", JSON.stringify(localReviews));
        } catch (e) {
          console.error("Failed to save review to localStorage:", e);
        }
        setIsSubmitting(false);
        setSubmitStatus("success");
        setProctorId("");
        setStudentName("");
        setVivaDate("");
        setQuestions([""]);
        setSuggestions("");
      }, 700);
      return;
    }

    try {
      const appsScriptUrl = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;
      const res = await fetch(appsScriptUrl!, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify(payload),
        redirect: "follow",
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to submit review");
      }

      setIsSubmitting(false);
      setSubmitStatus("success");
      setProctorId("");
      setStudentName("");
      setVivaDate("");
      setQuestions([""]);
      setSuggestions("");
    } catch (err: any) {
      console.error(err);
      setIsSubmitting(false);
      setSubmitStatus("error");
      setErrorMessage(err.message || "An unexpected error occurred. Please try again.");
    }
  };

  return (
    <div className="flex-1 flex flex-col font-sans min-h-screen bg-slate-50 text-slate-900 dark:bg-[#020617] dark:text-slate-100 transition-colors duration-300">
      
      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-white/70 dark:bg-[#020617]/70 backdrop-blur-lg border-b border-slate-200/50 dark:border-slate-800/50 py-3.5 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </div>
            <div>
              <span className="font-extrabold text-sm text-slate-900 dark:text-white block">MAD2 Proctor Lookup</span>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Return Home</span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            {isOfflineMode ? (
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/20 px-2.5 py-1 rounded-lg border border-amber-200/40 dark:border-amber-900/40">
                Offline Simulator
              </span>
            ) : (
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1 rounded-lg border border-emerald-200/40 dark:border-emerald-900/40">
                Live Server
              </span>
            )}

            <button
              onClick={toggleTheme}
              className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200/40 dark:border-slate-800/40 rounded-lg transition-all"
              aria-label="Toggle Theme"
            >
              {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl w-full mx-auto px-4 py-12 flex-1 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {submitStatus === "success" ? (
            /* Redesigned Success Screen */
            <motion.div
              key="success"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl p-8 shadow-xl text-center space-y-6"
            >
              <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto text-3xl shadow-md border border-emerald-100 dark:border-emerald-900/40">
                ✓
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Review Saved Successfully!</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-md mx-auto font-medium">
                  {isOfflineMode 
                    ? "Simulator Mode: Review simulated successfully. To permanently write reviews to Google Sheets, configure NEXT_PUBLIC_APPS_SCRIPT_URL in your .env.local file."
                    : "Thank you for contributing! Your experience has been saved directly to the database and will help other students prepare."}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <Link
                  href="/"
                  className="bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 font-bold px-6 py-3 rounded-2xl transition-colors text-sm shadow-md"
                >
                  Return to Dashboard
                </Link>
                <button
                  onClick={() => setSubmitStatus("idle")}
                  className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold px-6 py-3 rounded-2xl transition-colors text-sm"
                >
                  Add Another Review
                </button>
              </div>
            </motion.div>
          ) : (
            /* Redesigned Form */
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6"
            >
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#FF2D55] bg-rose-50 dark:bg-rose-950/20 px-3 py-1.5 rounded-full border border-rose-100 dark:border-rose-950/40 inline-block mb-3">
                  Share Knowledge
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  Add Proctor Review
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1 font-medium">
                  Help the community prepare by anonymous contribution of past viva questions.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                
                {/* Proctor ID Input */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    Proctor ID *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Level3_24, Level2_101"
                    value={proctorId}
                    onChange={(e) => setProctorId(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-orange-500/40 focus:bg-white dark:focus:bg-slate-900 transition-all text-sm font-semibold"
                    required
                  />
                </div>

                {/* Name & Date Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      Your Name (Optional)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><User className="w-4 h-4" /></span>
                      <input
                        type="text"
                        placeholder="Leave blank for Anonymous"
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-orange-500/40 focus:bg-white dark:focus:bg-slate-900 transition-all text-sm font-semibold"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      Viva Date (Optional)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><Calendar className="w-4 h-4" /></span>
                      <input
                        type="text"
                        placeholder="e.g. July 22, 2026"
                        value={vivaDate}
                        onChange={(e) => setVivaDate(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-orange-500/40 focus:bg-white dark:focus:bg-slate-900 transition-all text-sm font-semibold"
                      />
                    </div>
                  </div>
                </div>

                {/* Questions Section */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      Questions Asked
                    </label>
                    <button
                      type="button"
                      onClick={handleAddQuestionField}
                      className="text-xs font-bold text-[#FF2D55] hover:opacity-80 flex items-center gap-1 focus:outline-hidden"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Row</span>
                    </button>
                  </div>
                  <div className="space-y-2.5">
                    {questions.map((q, index) => (
                      <motion.div 
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex gap-2.5 items-center"
                      >
                        <span className="text-slate-400 dark:text-slate-500 text-xs font-bold w-4">{index + 1}.</span>
                        <input
                          type="text"
                          placeholder="e.g. Explain Vue lifecycle hook 'mounted'"
                          value={q}
                          onChange={(e) => handleQuestionChange(index, e.target.value)}
                          className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-orange-500/40 focus:bg-white dark:focus:bg-slate-900 transition-all text-xs sm:text-sm font-semibold"
                        />
                        {questions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveQuestionField(index)}
                            className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            title="Remove Question"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Suggestions Textarea */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    Tips & suggestions for Fellow Students
                  </label>
                  <textarea
                    placeholder="e.g. Friendly proctor, focuses heavily on database normalization, indexings, and caching questions..."
                    value={suggestions}
                    onChange={(e) => setSuggestions(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-orange-500/40 focus:bg-white dark:focus:bg-slate-900 transition-all text-sm font-semibold leading-relaxed resize-none"
                  />
                </div>

                {/* Error Banner */}
                {submitStatus === "error" && (
                  <div className="bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40 text-xs font-bold p-4 rounded-2xl flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    <span>{errorMessage || "Failed to submit review. Try again."}</span>
                  </div>
                )}

                {/* Form Buttons */}
                <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                  <Link
                    href="/"
                    className="bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold px-5 py-2.5 rounded-2xl transition-colors text-xs border border-slate-200/50 dark:border-slate-700/50"
                  >
                    Cancel
                  </Link>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-gradient-to-r from-[#FF6A00] to-[#FF2D55] text-white font-bold px-6 py-2.5 rounded-2xl shadow-lg shadow-orange-500/10 hover:opacity-95 active:scale-98 transition-all text-xs flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>Submit Review</span>
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-950 border-t border-slate-200/50 dark:border-slate-900 py-6 text-center text-xs text-slate-500 mt-auto">
        <span>&copy; {new Date().getFullYear()} MAD2 Viva Proctor Lookup &bull; Made by Ridhi Sehgal</span>
      </footer>
    </div>
  );
}
