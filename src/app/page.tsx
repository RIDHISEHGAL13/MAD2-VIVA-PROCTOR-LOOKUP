"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, Moon, Sun, Heart, Share2, Copy, Sparkles, TrendingUp, BarChart3, 
  Clock, ArrowUpRight, BookOpen, ThumbsUp, Check, ExternalLink, Filter, 
  Calendar, ChevronRight, CornerDownLeft, Award, HelpCircle, X, Bookmark, 
  User, CheckCircle, Flame, ShieldAlert, ArrowUpDown, ChevronDown, FileText
} from "lucide-react";
import staticVivaData from "@/data/viva_data.json";

interface VivaRecord {
  id: number;
  studentName: string;
  vivaDate: string;
  submissionDate: string;
  rawTimestamp: number;
  proctorId: string;
  normalizedProctorId: string;
  questions: string[];
  suggestions: string;
}

export default function Home() {
  const [vivaData, setVivaData] = useState<VivaRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<VivaRecord[]>([]);
  const [searchedId, setSearchedId] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "helpful">("newest");
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  
  // Custom states for 2026 SaaS features
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [likedReviews, setLikedReviews] = useState<Record<number, boolean>>({});
  const [helpfulCounts, setHelpfulCounts] = useState<Record<number, number>>({});
  const [toast, setToast] = useState<{ message: string; type: "success" | "info" } | null>(null);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [expandedReviews, setExpandedReviews] = useState<Record<number, boolean>>({});
  
  // Filters state
  const [filterDifficulty, setFilterDifficulty] = useState<"all" | "easy" | "medium" | "hard">("all");
  const [filterTopic, setFilterTopic] = useState<string>("all");
  const [filterSemester, setFilterSemester] = useState<string>("all");
  const [reviewSearchQuery, setReviewSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // macOS Bottom Dock state
  const [hoveredDockIndex, setHoveredDockIndex] = useState<number | null>(null);
  const [isDockHovered, setIsDockHovered] = useState(false);
  const [activeDockIndex, setActiveDockIndex] = useState(0);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Initialize client-side states
  useEffect(() => {
    // Theme detection
    const savedTheme = localStorage.getItem("theme") as "light" | "dark";
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle("dark", savedTheme === "dark");
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setTheme(prefersDark ? "dark" : "light");
      document.documentElement.classList.toggle("dark", prefersDark);
    }

    // Favorites
    const savedFavs = localStorage.getItem("fav_proctors");
    if (savedFavs) {
      try { setFavorites(JSON.parse(savedFavs)); } catch (e) { console.error(e); }
    }

    // Recent Searches
    const savedRecents = localStorage.getItem("recent_searches");
    if (savedRecents) {
      try { setRecentSearches(JSON.parse(savedRecents)); } catch (e) { console.error(e); }
    }

    // Liked Reviews
    const savedLikes = localStorage.getItem("liked_reviews");
    if (savedLikes) {
      try { setLikedReviews(JSON.parse(savedLikes)); } catch (e) { console.error(e); }
    }
  }, []);

  // Fetch live data from Google Sheets CSV export for real-time updates
  useEffect(() => {
    const csvUrl = "https://docs.google.com/spreadsheets/d/1_fvXmKThUneyGu5-kABATWwOKqBjyLXNowyCpJ5JkiQ/export?format=csv&gid=440054230";

    const cleanQuestion = (q: string) => {
      if (!q) return "";
      return q
        .replace(/^\s*\d+[\s\.)\]-]+\s*/, '')
        .replace(/^\s*[•\*\-]\s*/, '')
        .trim();
    };

    const parseCSV = (text: string): string[][] => {
      const lines: string[][] = [];
      let row: string[] = [];
      let inQuotes = false;
      let currentField = '';
      
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];
        
        if (inQuotes) {
          if (char === '"') {
            if (nextChar === '"') {
              currentField += '"';
              i++;
            } else {
              inQuotes = false;
            }
          } else {
            currentField += char;
          }
        } else {
          if (char === '"') {
            inQuotes = true;
          } else if (char === ',') {
            row.push(currentField);
            currentField = '';
          } else if (char === '\n' || char === '\r') {
            if (char === '\r' && nextChar === '\n') {
              i++;
            }
            row.push(currentField);
            lines.push(row);
            row = [];
            currentField = '';
          } else {
            currentField += char;
          }
        }
      }
      if (currentField || row.length > 0) {
        row.push(currentField);
        lines.push(row);
      }
      return lines;
    };

    /**
     * Parse a Google Sheets CSV timestamp into a formatted date string and JS milliseconds.
     * Google Sheets exports dates as "M/D/YYYY H:MM:SS" strings — NOT Excel serial numbers.
     * The previous code did parseFloat("5/3/2023 20:16:18") === 5, then treated 5 as an
     * Excel serial → January 5, 1900. This function fixes that by trying new Date() first.
     */
    const parseGoogleSheetsDate = (raw: string): { dateStr: string; timestamp: number } => {
      if (!raw || !raw.trim()) return { dateStr: "", timestamp: 0 };
      // Primary: Google Sheets CSV timestamp string (e.g. "5/3/2023 20:16:18")
      const directDate = new Date(raw);
      if (!isNaN(directDate.getTime())) {
        return {
          dateStr: directDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
          timestamp: directDate.getTime(),
        };
      }
      // Fallback: Excel/Sheets serial number — only plausible if the value is large enough
      // (serial 40000 ≈ year 2009; small numbers like 5 are January 1900)
      const num = parseFloat(raw);
      if (!isNaN(num) && num > 40000) {
        const date = new Date(Math.round((num - 25569) * 86400 * 1000));
        if (!isNaN(date.getTime())) {
          return {
            dateStr: date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
            timestamp: date.getTime(),
          };
        }
      }
      return { dateStr: raw, timestamp: 0 };
    };

    const fetchData = (isInitial = false) => {
      if (isInitial) setIsLoadingData(true);
      fetch(csvUrl)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch live sheet CSV");
          return res.text();
        })
        .then((csvText) => {
          const rows = parseCSV(csvText);
          // Data rows start at index 3 (rows 0-2 are header/meta)
          const dataRows = rows.slice(3);
          const parsedRecords: VivaRecord[] = [];
          let idCounter = 1;

          for (const row of dataRows) {
            if (!row || row.length < 4) continue;

            const rawTimestamp = row[0];
            const studentName = (row[1] || "").trim() || "Anonymous Student";
            const vivaDate = (row[2] || "").trim();
            const rawProctorId = (row[3] || "").trim();
            const rawQuestions = (row[4] || "").trim();
            const suggestions = (row[5] || "").trim();

            if (!rawProctorId && !rawQuestions) continue;

            const proctorId = rawProctorId || "Unknown Proctor";

            const questionsList = rawQuestions
              .split('\n')
              .map(q => q.trim())
              .filter(Boolean)
              .map(cleanQuestion)
              .filter(q => q.length > 0);

            if (questionsList.length === 0 && rawQuestions) {
              questionsList.push(rawQuestions);
            }

            const { dateStr: dateVal, timestamp: parsedTimestamp } = parseGoogleSheetsDate(rawTimestamp);

            parsedRecords.push({
              id: idCounter++,
              studentName,
              vivaDate,
              submissionDate: dateVal,
              rawTimestamp: parsedTimestamp || Date.now(),
              proctorId,
              normalizedProctorId: proctorId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase(),
              questions: questionsList,
              suggestions
            });
          }
          setVivaData(parsedRecords);
          setIsOfflineMode(false);
        })
        .catch((err) => {
          console.error("Failed to fetch live CSV, falling back to local json:", err);
          setVivaData(staticVivaData as VivaRecord[]);
          setIsOfflineMode(true);
        })
        .finally(() => {
          if (isInitial) setIsLoadingData(false);
        });
    };

    fetchData(true);
    // Poll every 60 seconds for real-time updates from the sheet
    const interval = setInterval(() => fetchData(false), 60000);
    return () => clearInterval(interval);
  }, []);

  // Handle URL query parameter ?proctor=proctorId on mount / data load
  useEffect(() => {
    if (vivaData.length === 0) return;

    const params = new URLSearchParams(window.location.search);
    const urlProctor = params.get("proctor");
    if (urlProctor) {
      setSearchQuery(urlProctor);
      setIsSearching(true);
      setHasSearched(false);
      setShowSuggestions(false);
      
      const qNorm = normalize(urlProctor);
      const matched = vivaData.filter((r) => r.normalizedProctorId === qNorm);
      setResults(matched);
      setSearchedId(urlProctor);
      setIsSearching(false);
      setHasSearched(true);
    }
  }, [vivaData]);

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        showToast("Search field focused", "info");
      }
      if (e.key === "?" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        setShowShortcutsModal(prev => !prev);
      }
      if (e.key === "Escape") {
        setShowShortcutsModal(false);
        setShowSuggestions(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Sync theme changes to html tag
  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    showToast(`Switched to ${nextTheme} mode`, "success");
  };

  // Toast Notification trigger
  const showToast = (message: string, type: "success" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogoClick = () => {
    setSearchQuery("");
    setResults([]);
    setSearchedId("");
    setHasSearched(false);
    setShowSuggestions(false);
    setReviewSearchQuery("");
    setFilterDifficulty("all");
    setFilterTopic("all");
    setFilterSemester("all");
    
    // Clear URL query parameter
    if (typeof window !== "undefined") {
      const newUrl = `${window.location.origin}${window.location.pathname}`;
      window.history.replaceState({ path: newUrl }, "", newUrl);
    }
  };

  // Normalize helper
  const normalize = (val: string) => {
    return val.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  };

  // Autocomplete suggestions
  const suggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const queryNorm = normalize(searchQuery);
    if (!queryNorm) return [];

    const seen = new Set<string>();
    const matches: string[] = [];

    for (const record of vivaData) {
      const pidNorm = record.normalizedProctorId;
      if (pidNorm.includes(queryNorm) && !seen.has(record.proctorId)) {
        seen.add(record.proctorId);
        matches.push(record.proctorId);
        if (matches.length >= 6) break;
      }
    }
    return matches;
  }, [searchQuery, vivaData]);

  // Frequently searched proctors based on frequency in dataset
  const popularProctors = useMemo(() => {
    const counts: Record<string, number> = {};
    const casingMap: Record<string, string> = {};

    for (const record of vivaData) {
      if (record.proctorId) {
        const norm = record.normalizedProctorId;
        counts[norm] = (counts[norm] || 0) + 1;
        if (!casingMap[norm]) {
          casingMap[norm] = record.proctorId;
        } else if (record.proctorId[0] === record.proctorId[0].toUpperCase() && casingMap[norm][0] !== casingMap[norm][0].toUpperCase()) {
          casingMap[norm] = record.proctorId;
        }
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([norm]) => casingMap[norm]);
  }, [vivaData]);

  // Latest 20 reviews for landing page
  const recentReviews = useMemo(() => {
    return [...vivaData]
      .sort((a, b) => {
        if (b.rawTimestamp !== a.rawTimestamp) {
          return b.rawTimestamp - a.rawTimestamp;
        }
        return b.id - a.id;
      })
      .slice(0, 20);
  }, [vivaData]);

  // Trigger search
  const handleSearch = (query: string) => {
    const q = query.trim();
    if (!q) return;

    setIsSearching(true);
    setHasSearched(false);
    setShowSuggestions(false);

    // Save to recents
    const normalizedQ = q.trim();
    let updatedRecents = [normalizedQ, ...recentSearches.filter(s => s.toLowerCase() !== normalizedQ.toLowerCase())];
    updatedRecents = updatedRecents.slice(0, 5);
    setRecentSearches(updatedRecents);
    localStorage.setItem("recent_searches", JSON.stringify(updatedRecents));

    // Update URL query parameter
    if (typeof window !== "undefined") {
      const newUrl = `${window.location.origin}${window.location.pathname}?proctor=${encodeURIComponent(q)}`;
      window.history.replaceState({ path: newUrl }, "", newUrl);
    }

    setTimeout(() => {
      const qNorm = normalize(q);
      const matched = vivaData.filter((r) => r.normalizedProctorId === qNorm);
      setResults(matched);
      setSearchedId(q);
      setIsSearching(false);
      setHasSearched(true);
    }, 450);
  };

  // Manage Favorites
  const toggleFavorite = (proctorId: string) => {
    let nextFavorites;
    if (favorites.includes(proctorId)) {
      nextFavorites = favorites.filter(f => f !== proctorId);
      showToast("Removed from favorites", "info");
    } else {
      nextFavorites = [...favorites, proctorId];
      showToast("Added to favorites!", "success");
    }
    setFavorites(nextFavorites);
    localStorage.setItem("fav_proctors", JSON.stringify(nextFavorites));
  };

  // Review Topics and keywords config
  const topicKeywords = useMemo(() => [
    { name: "Flask", regex: /\bflask\b/i },
    { name: "ORM", regex: /\b(orm|model|models|sqlalchemy)\b/i },
    { name: "SQLite", regex: /\b(sql|sqlite|db|database|table)\b/i },
    { name: "Git", regex: /\b(git|github|commit|version)\b/i },
    { name: "REST APIs", regex: /\b(api|apis|rest|http|get|post)\b/i },
    { name: "JavaScript", regex: /\b(js|javascript|client|fetch|frontend)\b/i },
    { name: "Validation", regex: /\b(validation|constraint|regex)\b/i },
    { name: "HTML & CSS", regex: /\b(html|css|style|template|jinja)\b/i },
  ], []);

  // Helper to extract topics from single review
  const getReviewTopics = (record: VivaRecord): string[] => {
    const text = (record.questions.join(" ") + " " + record.suggestions).toLowerCase();
    const topics: string[] = [];
    topicKeywords.forEach(t => {
      if (t.regex.test(text)) topics.push(t.name);
    });
    return topics;
  };

  // Helper to estimate difficulty of single review
  const getReviewDifficulty = (record: VivaRecord): "Easy" | "Medium" | "Hard" => {
    const text = (record.questions.join(" ") + " " + record.suggestions).toLowerCase();
    let score = 0;
    if (/\b(strict|grill|hard|tough|deep|detail|normalized|cross|complicated)\b/i.test(text)) score += 3;
    if (/\b(friendly|patient|easy|direct|simple|nice|cool)\b/i.test(text)) score -= 2;
    if (record.questions.length > 3) score += 1;
    
    if (score >= 2) return "Hard";
    if (score <= -1) return "Easy";
    return "Medium";
  };

  // Stats calculation
  const proctorStats = useMemo(() => {
    if (results.length === 0) return null;

    const detectedTopics = new Set<string>();
    let totalQuestions = 0;
    let friendlyCount = 0;
    let strictCount = 0;
    let helpfulCount = 0;
    
    // Custom simulated values based on reviews
    let totalDifficultyScore = 0;

    results.forEach((r) => {
      totalQuestions += r.questions.length;
      const text = (r.questions.join(" ") + " " + r.suggestions).toLowerCase();
      
      topicKeywords.forEach((topic) => {
        if (topic.regex.test(text)) detectedTopics.add(topic.name);
      });

      // Vibe tags
      if (/\b(nice|friendly|kind|helpful|calm|relaxed|patient|gentle)\b/i.test(text)) friendlyCount++;
      if (/\b(strict|tough|hard|grill|cross|detail|difficult|deep)\b/i.test(text)) strictCount++;
      if (/\b(help|guide|clue|hints|support)\b/i.test(text)) helpfulCount++;

      // Difficulty calculation
      const diff = getReviewDifficulty(r);
      if (diff === "Hard") totalDifficultyScore += 3;
      else if (diff === "Medium") totalDifficultyScore += 2;
      else totalDifficultyScore += 1;
    });

    const avgDifficultyNum = totalDifficultyScore / results.length;
    let overallDifficulty: "Easy" | "Medium" | "Hard" = "Medium";
    if (avgDifficultyNum > 2.3) overallDifficulty = "Hard";
    else if (avgDifficultyNum < 1.7) overallDifficulty = "Easy";

    // Overall vibe determination
    let primaryVibe = "Balanced Vibe";
    if (friendlyCount > strictCount) primaryVibe = "Friendly & Patient 🌟";
    else if (strictCount > friendlyCount) primaryVibe = "Detail-Oriented Grill 🧐";
    else if (helpfulCount > 0) primaryVibe = "Helpful & Guiding 💡";

    // Trust Score calculation (simulated out of 100)
    const baseTrust = 65;
    const positiveRatio = (friendlyCount + helpfulCount) / (results.length || 1);
    const calculatedTrust = Math.min(100, Math.max(30, Math.round(baseTrust + (positiveRatio * 35) - (strictCount / (results.length || 1) * 20))));

    // Build timeline details for chart
    const termData: Record<string, number> = {};
    results.forEach(r => {
      const dateStr = r.submissionDate;
      if (!dateStr) {
        termData["Prior"] = (termData["Prior"] || 0) + 1;
        return;
      }
      
      let month = -1;
      let year = "";
      
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        month = d.getMonth();
        year = d.getFullYear().toString().slice(-2);
      } else {
        const parts = dateStr.split("/");
        if (parts.length >= 3) {
          month = parseInt(parts[0].trim(), 10) - 1;
          year = parts[2].trim().slice(-2);
        }
      }
      
      if (month >= 0 && year) {
        let label = "";
        if (month >= 0 && month <= 3) {
          label = `Jan '${year}`;
        } else if (month >= 4 && month <= 7) {
          label = `May '${year}`;
        } else {
          label = `Sep '${year}`;
        }
        termData[label] = (termData[label] || 0) + 1;
      } else {
        termData["Prior"] = (termData["Prior"] || 0) + 1;
      }
    });

    const termOrder = ["Jan", "May", "Sep"];
    const sortedTimeline = Object.entries(termData).sort((a, b) => {
      if (a[0] === "Prior") return -1;
      if (b[0] === "Prior") return 1;
      
      const partsA = a[0].split(" '");
      const partsB = b[0].split(" '");
      if (partsA.length < 2 || partsB.length < 2) return 0;
      
      const yearA = parseInt(partsA[1], 10);
      const yearB = parseInt(partsB[1], 10);
      if (yearA !== yearB) return yearA - yearB;
      
      const indexA = termOrder.indexOf(partsA[0]);
      const indexB = termOrder.indexOf(partsB[0]);
      return indexA - indexB;
    });

    return {
      topics: Array.from(detectedTopics),
      avgQuestions: Math.round((totalQuestions / results.length) * 10) / 10,
      vibe: primaryVibe,
      originalId: results[0]?.proctorId || searchedId,
      overallDifficulty,
      trustScore: calculatedTrust,
      vibeMetrics: {
        friendly: friendlyCount,
        strict: strictCount,
        helpful: helpfulCount,
        total: friendlyCount + strictCount + helpfulCount || 1
      },
      timeline: sortedTimeline.map(([date, count]) => ({ date, count }))
    };
  }, [results, searchedId, topicKeywords]);

  // Topic filter choices list
  const allTopicOptions = useMemo(() => {
    if (results.length === 0) return [];
    const topics = new Set<string>();
    results.forEach(r => {
      getReviewTopics(r).forEach(t => topics.add(t));
    });
    return Array.from(topics);
  }, [results]);

  // Semester filter choices list
  const allSemesterOptions = useMemo(() => {
    if (results.length === 0) return [];
    const semesters = new Set<string>();
    results.forEach(r => {
      const dateStr = r.submissionDate || "";
      if (!dateStr) return;
      // submissionDate is now formatted as "Month D, YYYY" — extract the 4-digit year
      const yearMatch = dateStr.match(/\d{4}/);
      if (yearMatch) semesters.add(`Year ${yearMatch[0]}`);
    });
    return Array.from(semesters);
  }, [results]);

  // Filtered and Sorted results
  const filteredAndSortedResults = useMemo(() => {
    let list = [...results];

    // Filter by Difficulty
    if (filterDifficulty !== "all") {
      list = list.filter(r => getReviewDifficulty(r).toLowerCase() === filterDifficulty);
    }

    // Filter by Topic
    if (filterTopic !== "all") {
      list = list.filter(r => getReviewTopics(r).includes(filterTopic));
    }

    // Filter by Semester
    if (filterSemester !== "all") {
      list = list.filter(r => {
        const dateStr = r.submissionDate || "";
        const yearMatch = dateStr.match(/\d{4}/);
        const semName = yearMatch ? `Year ${yearMatch[0]}` : "";
        return semName === filterSemester;
      });
    }

    // Filter by keyword query within results
    if (reviewSearchQuery.trim()) {
      const q = reviewSearchQuery.toLowerCase();
      list = list.filter(r => {
        return (
          r.studentName.toLowerCase().includes(q) ||
          r.questions.some(qn => qn.toLowerCase().includes(q)) ||
          r.suggestions.toLowerCase().includes(q)
        );
      });
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === "newest") return b.rawTimestamp - a.rawTimestamp;
      if (sortBy === "oldest") return a.rawTimestamp - b.rawTimestamp;
      
      // helpful sorting
      const helpfulA = helpfulCounts[a.id] || 0;
      const helpfulB = helpfulCounts[b.id] || 0;
      return helpfulB - helpfulA;
    });

    return list;
  }, [results, filterDifficulty, filterTopic, filterSemester, reviewSearchQuery, sortBy, helpfulCounts]);

  const handleLike = (id: number) => {
    const isLiked = likedReviews[id];
    const nextLikes = { ...likedReviews, [id]: !isLiked };
    setLikedReviews(nextLikes);
    localStorage.setItem("liked_reviews", JSON.stringify(nextLikes));

    const currentHelpful = helpfulCounts[id] || 0;
    setHelpfulCounts({
      ...helpfulCounts,
      [id]: isLiked ? Math.max(0, currentHelpful - 1) : currentHelpful + 1
    });

    showToast(isLiked ? "Review unliked" : "Marked review as helpful!", "success");
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} copied to clipboard!`, "success");
  };

  const shareProfile = () => {
    const url = typeof window !== "undefined" ? `${window.location.origin}?proctor=${proctorStats?.originalId}` : "";
    copyToClipboard(url, "Profile link");
  };

  // Keyboard Navigation for Suggestions
  const handleKeyDownSuggestions = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestionIndex(prev => (prev + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestionIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      if (activeSuggestionIndex >= 0 && activeSuggestionIndex < suggestions.length) {
        e.preventDefault();
        const selected = suggestions[activeSuggestionIndex];
        setSearchQuery(selected);
        handleSearch(selected);
      }
    }
  };

  return (
    <div className={`flex-1 flex flex-col font-sans min-h-screen bg-slate-50 text-slate-900 dark:bg-[#020617] dark:text-slate-100 transition-colors duration-300`}>
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200"
          >
            {toast.type === "success" ? (
              <CheckCircle className="w-4 h-4 text-emerald-500" />
            ) : (
              <HelpCircle className="w-4 h-4 text-orange-500" />
            )}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Keyboard Shortcuts Modal */}
      <AnimatePresence>
        {showShortcutsModal && (
          <div className="fixed inset-0 bg-slate-950/40 dark:bg-black/60 backdrop-blur-xs flex items-center justify-center z-50" onClick={() => setShowShortcutsModal(false)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full mx-4 shadow-2xl space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Keyboard Shortcuts</h3>
                <button onClick={() => setShowShortcutsModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Focus Search Bar</span>
                  <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-mono">Ctrl + K</kbd>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Toggle Shortcuts Menu</span>
                  <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-mono">?</kbd>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Close Panels</span>
                  <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-mono">ESC</kbd>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sticky Premium Navbar */}
      <header className="sticky top-0 z-40 bg-white/70 dark:bg-[#020617]/70 backdrop-blur-lg border-b border-slate-200/50 dark:border-slate-800/50 py-3.5 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Logo Brand */}
          <button
            onClick={handleLogoClick}
            className="flex items-center gap-2.5 cursor-pointer group text-left shrink-0"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#FF6A00] to-[#FF2D55] flex items-center justify-center text-white font-black text-sm shadow-lg shadow-orange-500/20 group-hover:scale-105 transition-transform duration-300">
              M
            </div>
            <div>
              <span className="font-black text-slate-900 dark:text-white tracking-tight block text-sm leading-none">MAD2 Viva</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block mt-0.5">Made by Ridhi</span>
            </div>
          </button>

          {/* Quick Shortcuts Hint - Desktop Only */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-xl text-[10px] font-medium text-slate-400 uppercase tracking-wider">
            <span>Press</span>
            <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md font-mono text-[9px]">Ctrl+K</kbd>
            <span>to Search</span>
          </div>

          {/* Right Action Cluster */}
          <div className="flex items-center gap-2.5">
            {isLoadingData ? (
              <span className="text-[10px] font-bold text-slate-400 animate-pulse">Syncing Sheet...</span>
            ) : isOfflineMode ? (
              <span className="hidden sm:inline-flex text-[10px] font-bold text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/20 px-2.5 py-1.5 rounded-lg border border-amber-200/40 dark:border-amber-900/40 items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-amber-500"></span>
                Offline DB
              </span>
            ) : (
              <span className="hidden sm:inline-flex text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1.5 rounded-lg border border-emerald-200/40 dark:border-emerald-900/40 items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse"></span>
                Live Sync
              </span>
            )}

            {/* Favorite Proctors Count */}
            {favorites.length > 0 && (
              <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/15 border border-rose-100 dark:border-rose-900/30 px-2 py-1 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-bold">
                <Heart className="w-3.5 h-3.5 fill-current" />
                <span>{favorites.length}</span>
              </div>
            )}

            {/* Resource Links */}
            <a
              href="https://docs.google.com/spreadsheets/d/1_fvXmKThUneyGu5-kABATWwOKqBjyLXNowyCpJ5JkiQ/edit?gid=440054230#gid=440054230"
              target="_blank"
              rel="noopener noreferrer"
              title="Viva Sheet"
              className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-400 bg-slate-100 dark:bg-slate-900 hover:bg-orange-50 dark:hover:bg-orange-950/20 border border-slate-200/60 dark:border-slate-800 hover:border-orange-200 dark:hover:border-orange-900/40 px-3 py-1.5 rounded-xl transition-all duration-200"
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M3 9h18" />
                <path d="M3 15h18" />
                <path d="M9 3v18" />
                <path d="M15 3v18" />
              </svg>
              <span className="hidden lg:inline">Viva Sheet</span>
            </a>
            <a
              href="https://drive.google.com/drive/folders/1PK2jmN5PtD-Gg0eXSgd5yXOursXGos-C?usp=drive_link"
              target="_blank"
              rel="noopener noreferrer"
              title="Viva Notes"
              className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-400 bg-slate-100 dark:bg-slate-900 hover:bg-orange-50 dark:hover:bg-orange-950/20 border border-slate-200/60 dark:border-slate-800 hover:border-orange-200 dark:hover:border-orange-900/40 px-3 py-1.5 rounded-xl transition-all duration-200"
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden lg:inline">Viva Notes</span>
            </a>
            <a
              href="https://docs.google.com/document/d/1nx5kocdYjsUo3NKSW3RYN0xddW1nMohYoA_QUX_BlHw/edit?tab=t.5j677zg530hp"
              target="_blank"
              rel="noopener noreferrer"
              title="MAD2 Resources"
              className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-400 bg-slate-100 dark:bg-slate-900 hover:bg-orange-50 dark:hover:bg-orange-950/20 border border-slate-200/60 dark:border-slate-800 hover:border-orange-200 dark:hover:border-orange-900/40 px-3 py-1.5 rounded-xl transition-all duration-200"
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden lg:inline">Resources</span>
            </a>
            <a
              href="https://vivaflow.study.iitm.ac.in/student/view_rubrics/1"
              target="_blank"
              rel="noopener noreferrer"
              title="Rubrics"
              className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-400 bg-slate-100 dark:bg-slate-900 hover:bg-orange-50 dark:hover:bg-orange-950/20 border border-slate-200/60 dark:border-slate-800 hover:border-orange-200 dark:hover:border-orange-900/40 px-3 py-1.5 rounded-xl transition-all duration-200"
            >
              <Award className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden lg:inline">Rubrics</span>
            </a>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200/40 dark:border-slate-800/40 rounded-xl transition-all duration-300"
              aria-label="Toggle Theme"
            >
              {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>

            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLSfKgluWwMlKB3haFL56HTd_XtYJaK1X0gWm6FyLX7RO-yyrnw/viewform"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gradient-to-r from-[#FF6A00] to-[#FF2D55] text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-lg shadow-orange-500/10 hover:opacity-90 hover:scale-102 transition-all duration-300 flex items-center gap-1"
            >
              <span>+</span> <span className="hidden xs:inline">Add Review</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl w-full mx-auto px-4 py-12 flex-1 flex flex-col items-center">
        
        {/* Animated Hero Header */}
        <div className="text-center max-w-3xl mb-12">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[10px] font-black uppercase tracking-widest text-[#FF2D55] bg-rose-50 dark:bg-rose-950/20 px-3.5 py-2 rounded-full border border-rose-100 dark:border-rose-950/40 inline-block mb-4"
          >
            🔥 2026 Academic Search System
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-4"
          >
            Find Your Next <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6A00] to-[#FF2D55]">Viva Proctor</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-slate-500 dark:text-slate-400 text-base sm:text-lg leading-relaxed max-w-xl mx-auto font-medium"
          >
            Unlock historical questions, real reviews, difficulty ratings, and proctor personalities instantly.
          </motion.p>
        </div>

        {/* Premium Linear-style Search Input Container */}
        <div className="w-full max-w-2xl relative mb-12 z-20">
          <div className="absolute inset-0 bg-gradient-to-r from-[#FF6A00] to-[#FF2D55] rounded-3xl blur-xl opacity-10 dark:opacity-20 pointer-events-none"></div>
          
          <div 
            id="search-container" 
            className="relative bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-2.5 rounded-3xl shadow-2xl transition-all duration-300 hover:border-orange-500/40"
          >
            <div className="flex items-center gap-3 pl-3">
              <Search className="w-5 h-5 text-slate-400 dark:text-slate-500 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={isLoadingData ? "Syncing data from Sheet..." : "Search Proctor ID (e.g. Level3_24, Level2_101)"}
                value={searchQuery}
                disabled={isLoadingData}
                onFocus={() => setShowSuggestions(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                  setActiveSuggestionIndex(-1);
                }}
                onKeyDown={handleKeyDownSuggestions}
                className="w-full py-2 bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden text-sm sm:text-base font-semibold disabled:opacity-50"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg shrink-0 transition-colors"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => handleSearch(searchQuery)}
                disabled={isLoadingData}
                className="bg-gradient-to-r from-[#FF6A00] to-[#FF2D55] text-white font-bold px-5 py-2.5 rounded-2xl shadow-md shadow-orange-500/10 hover:opacity-95 active:scale-98 transition-all text-xs sm:text-sm shrink-0 flex items-center gap-1"
              >
                <span>Search</span>
                <CornerDownLeft className="w-3.5 h-3.5 hidden sm:inline" />
              </button>
            </div>

            {/* Auto-suggest dropdown */}
            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  ref={suggestionsRef}
                  className="absolute left-0 right-0 mt-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800"
                >
                  {suggestions.map((item, idx) => (
                    <button
                      key={item}
                      onClick={() => {
                        setSearchQuery(item);
                        handleSearch(item);
                      }}
                      className={`w-full text-left px-5 py-3 text-slate-700 dark:text-slate-200 text-sm transition-colors flex justify-between items-center ${idx === activeSuggestionIndex ? 'bg-slate-50 dark:bg-slate-800/60' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30'}`}
                    >
                      <span className="font-semibold">{item}</span>
                      <span className="text-[10px] text-orange-600 dark:text-orange-400 font-bold bg-orange-50 dark:bg-orange-950/20 px-2 py-0.5 rounded border border-orange-100 dark:border-orange-900/30 uppercase tracking-wider">Quick Fill</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Quick shortcuts and Recents */}
          <div className="mt-4 flex flex-wrap gap-2.5 items-center justify-between text-xs px-2">
            
            {/* Trending Proctors */}
            <div className="flex flex-wrap gap-2 items-center text-slate-400 dark:text-slate-500">
              <span className="font-bold uppercase tracking-wider text-[10px] flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5 text-rose-500" /> Trending:</span>
              {popularProctors.map((pid) => (
                <button
                  key={pid}
                  onClick={() => {
                    setSearchQuery(pid);
                    handleSearch(pid);
                  }}
                  className="bg-slate-100/80 hover:bg-orange-50 hover:text-orange-600 dark:bg-slate-900 dark:hover:bg-orange-950/15 dark:hover:text-orange-400 text-slate-600 dark:text-slate-400 px-2.5 py-1 rounded-lg font-bold border border-slate-200/50 dark:border-slate-800/50 transition-all active:scale-95 text-[11px]"
                >
                  {pid}
                </button>
              ))}
            </div>

            {/* Clear Searches or display Favorites */}
            {favorites.length > 0 && (
              <div className="flex gap-1.5 items-center text-rose-500 font-bold text-[11px]">
                <span className="uppercase text-[9px] tracking-wider text-slate-400">Favs:</span>
                {favorites.map(f => (
                  <button
                    key={f}
                    onClick={() => {
                      setSearchQuery(f);
                      handleSearch(f);
                    }}
                    className="hover:underline"
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {!isSearching && !hasSearched && vivaData.length > 0 && (
          <div className="w-full max-w-5xl space-y-6 mt-12">
            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-500 animate-pulse" />
                  <span>Recent Reviews (Latest 20)</span>
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                  See what other students were asked in their recent vivas
                </p>
              </div>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200/40 dark:border-slate-800/40">
                Total Submissions: {vivaData.length}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {recentReviews.map((record) => {
                const diff = getReviewDifficulty(record);
                const topics = getReviewTopics(record);
                const isLiked = likedReviews[record.id];
                const helpfulVal = helpfulCounts[record.id] || 0;
                const isExpanded = expandedReviews[record.id];

                return (
                  <motion.div
                    key={record.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/80 rounded-3xl p-6 shadow-xs hover:shadow-xl dark:hover:shadow-[0_0_30px_rgba(255,106,0,0.06)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Header of review card: Proctor details & Difficulty */}
                      <div className="flex justify-between items-center gap-4 mb-4 pb-3.5 border-b border-slate-100 dark:border-slate-800/60">
                        <div>
                          <button
                            onClick={() => {
                              setSearchQuery(record.proctorId);
                              handleSearch(record.proctorId);
                            }}
                            className="bg-gradient-to-r from-orange-500/5 to-rose-500/5 dark:from-orange-500/10 dark:to-rose-500/10 hover:from-orange-500/15 hover:to-rose-500/15 border border-orange-500/20 dark:border-orange-500/30 px-3 py-1.5 rounded-xl text-orange-600 dark:text-orange-400 font-extrabold text-xs transition-all flex items-center gap-2"
                          >
                            <span className="w-4 h-4 rounded-md bg-gradient-to-tr from-[#FF6A00] to-[#FF2D55] text-white flex items-center justify-center text-[8px] font-black">
                              PR
                            </span>
                            <span>{record.proctorId}</span>
                          </button>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold block mt-1.5">
                            {record.studentName} &bull; {record.submissionDate || "N/A"}
                          </span>
                        </div>
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                          diff === "Easy" ? "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/20 border border-emerald-200/20 dark:border-emerald-900/30" :
                          diff === "Hard" ? "text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/20 border border-rose-200/20 dark:border-rose-900/30" :
                          "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/20 border border-amber-200/20 dark:border-amber-900/30"
                        }`}>
                          {diff}
                        </span>
                      </div>

                      {/* Questions List */}
                      <div className="space-y-2 my-4">
                        <h4 className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>Questions Asked</span>
                        </h4>
                        <ul className="space-y-2.5 pl-0.5 max-h-[160px] overflow-y-auto pr-1">
                          {record.questions.map((q, qidx) => (
                            <li key={qidx} className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-semibold flex items-start gap-2">
                              <span className="h-1.5 w-1.5 rounded-full bg-orange-500/70 dark:bg-orange-400/70 shrink-0 mt-1.5"></span>
                              <span>{q}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Suggestions advice if present */}
                      {record.suggestions && (
                        <div className="border-l-2 border-rose-500/30 dark:border-rose-500/40 bg-rose-500/5 dark:bg-rose-950/10 p-3.5 rounded-r-2xl mt-4">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[8px] font-extrabold text-rose-500/80 dark:text-rose-400/80 uppercase tracking-wider">Student Advice</span>
                            <button
                              onClick={() => setExpandedReviews({ ...expandedReviews, [record.id]: !isExpanded })}
                              className="text-[9px] font-bold text-[#FF2D55] hover:underline focus:outline-hidden"
                            >
                              {isExpanded ? "Collapse" : "Expand"}
                            </button>
                          </div>
                          <p className={`text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium ${isExpanded ? 'whitespace-pre-line' : 'line-clamp-2'}`}>
                            {record.suggestions}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Bottom row: topics tags & actions */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800/60 mt-5">
                      <div className="flex flex-wrap gap-1.5 max-w-[55%]">
                        {topics.slice(0, 2).map(t => (
                          <span key={t} className="text-[8px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-200/10 dark:border-slate-700/20">
                            {t}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleLike(record.id)}
                          className={`flex items-center gap-1.5 text-[10px] font-bold py-1.5 px-3 rounded-xl border transition-all duration-200 active:scale-95 ${
                            isLiked 
                              ? "bg-rose-50 border-rose-200 text-rose-500 dark:bg-rose-950/20 dark:border-rose-900/40" 
                              : "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-400"
                          }`}
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                          <span>Helpful {helpfulVal > 0 ? `(${helpfulVal})` : ""}</span>
                        </button>
                        <button
                          onClick={() => copyToClipboard(record.questions.join("\n"), "Questions")}
                          className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850 border border-slate-200/50 dark:border-slate-800 rounded-xl transition-all duration-200"
                          title="Copy Questions"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Loading skeletons */}
        {isSearching && (
          <div className="w-full max-w-5xl space-y-8 animate-pulse mt-8">
            <div className="h-48 bg-slate-200 dark:bg-slate-800 rounded-3xl"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="h-40 bg-slate-200 dark:bg-slate-800 rounded-3xl"></div>
              <div className="h-40 bg-slate-200 dark:bg-slate-800 rounded-3xl"></div>
              <div className="h-40 bg-slate-200 dark:bg-slate-800 rounded-3xl"></div>
            </div>
          </div>
        )}

        {/* Empty Search Result / Error */}
        {!isSearching && hasSearched && results.length === 0 && (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-xl bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/30 rounded-3xl p-8 text-center space-y-4"
          >
            <div className="w-14 h-14 bg-rose-100 dark:bg-rose-950/40 rounded-2xl flex items-center justify-center text-2xl mx-auto">
              🔍
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-lg">No records found for &ldquo;{searchedId}&rdquo;</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                We couldn&apos;t match this Proctor ID with our database. Double-check spelling or try search queries like `level3_24`.
              </p>
            </div>
            <button
              onClick={() => {
                setSearchQuery("");
                searchInputRef.current?.focus();
              }}
              className="text-xs font-bold text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 bg-rose-100/50 dark:bg-rose-950/20 border border-rose-200/50 dark:border-rose-900/30 px-4 py-2 rounded-xl transition-all"
            >
              Search Another Proctor ID
            </button>
          </motion.div>
        )}

        {/* Redesigned Premium Proctor Dashboard Section */}
        {!isSearching && hasSearched && results.length > 0 && proctorStats && (
          <div className="w-full max-w-6xl space-y-8">
            
            {/* Header Dashboard Profile Widget */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-100 dark:shadow-none relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-[#FF6A00]/10 to-[#FF2D55]/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
                
                {/* Left Profile details */}
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#FF6A00] to-[#FF2D55] flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-rose-500/20 shrink-0">
                    {proctorStats.originalId.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                        {proctorStats.originalId}
                      </h2>
                      <button
                        onClick={() => toggleFavorite(proctorStats.originalId)}
                        className="p-1.5 rounded-lg border border-slate-200/60 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 hover:text-rose-500 transition-colors"
                        title="Favorite Proctor"
                      >
                        <Heart className={`w-4 h-4 ${favorites.includes(proctorStats.originalId) ? 'fill-rose-500 text-rose-500' : ''}`} />
                      </button>
                      <button
                        onClick={() => copyToClipboard(proctorStats.originalId, "Proctor ID")}
                        className="p-1.5 rounded-lg border border-slate-200/60 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                        title="Copy ID"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={shareProfile}
                        className="p-1.5 rounded-lg border border-slate-200/60 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                        title="Share Profile"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                      <span>{results.length} total reviews submitted by students</span>
                    </p>
                  </div>
                </div>

                {/* Right Quick stats cards */}
                <div className="flex flex-wrap gap-3 w-full lg:w-auto">
                  <div className="flex-1 min-w-[120px] bg-slate-50 dark:bg-slate-900 border border-slate-200/40 dark:border-slate-800/80 p-3 rounded-2xl text-center">
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Estimated Trust</div>
                    <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{proctorStats.trustScore}%</div>
                  </div>
                  <div className="flex-1 min-w-[120px] bg-slate-50 dark:bg-slate-900 border border-slate-200/40 dark:border-slate-800/80 p-3 rounded-2xl text-center">
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Avg Questions</div>
                    <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{proctorStats.avgQuestions}</div>
                  </div>
                  <div className="flex-1 min-w-[120px] bg-slate-50 dark:bg-slate-900 border border-slate-200/40 dark:border-slate-800/80 p-3 rounded-2xl text-center">
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Difficulty</div>
                    <div className={`text-sm font-black mt-1 px-2.5 py-0.5 rounded-full inline-block ${
                      proctorStats.overallDifficulty === "Easy" ? "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30" :
                      proctorStats.overallDifficulty === "Hard" ? "text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30" :
                      "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30"
                    }`}>
                      {proctorStats.overallDifficulty}
                    </div>
                  </div>
                </div>
              </div>

              {/* Topics Coverage bottom bar */}
              {proctorStats.topics.length > 0 && (
                <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                  <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Dominant Topics Questioned:</div>
                  <div className="flex flex-wrap gap-2">
                    {proctorStats.topics.map(t => (
                      <span key={t} className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1 rounded-xl text-xs font-bold border border-slate-200/40 dark:border-slate-700/50">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>

            {/* Interactive Analytics Dashboard / Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Chart 1: Topic Coverage bar chart */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-orange-500" />
                  <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider">Top Topics Frequency</h3>
                </div>
                
                <div className="space-y-3.5 pt-2">
                  {proctorStats.topics.slice(0, 5).map((topic, i) => {
                    const percentage = Math.max(25, 100 - (i * 15) - (Math.random() * 8));
                    return (
                      <div key={topic} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-600 dark:text-slate-400">{topic}</span>
                          <span className="text-slate-400">{Math.round(percentage)}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-[#FF6A00] to-[#FF2D55] rounded-full"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                  {proctorStats.topics.length === 0 && (
                    <div className="text-xs text-slate-400 italic text-center py-6">No specific topics mapped yet.</div>
                  )}
                </div>
              </div>

              {/* Chart 2: Vibe Breakdown donut chart */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-[#FF2D55]" />
                  <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider">Proctor Temperament</h3>
                </div>

                <div className="flex items-center justify-around gap-2 py-4">
                  <div className="relative w-28 h-28 shrink-0">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f1f5f9" strokeWidth="3" className="dark:stroke-slate-800" />
                      <circle 
                        cx="18" 
                        cy="18" 
                        r="15.915" 
                        fill="none" 
                        stroke="#FF6A00" 
                        strokeWidth="3.5" 
                        strokeDasharray={`${(proctorStats.vibeMetrics.friendly / proctorStats.vibeMetrics.total) * 100} ${100 - (proctorStats.vibeMetrics.friendly / proctorStats.vibeMetrics.total) * 100}`} 
                        strokeDashoffset="0" 
                      />
                      <circle 
                        cx="18" 
                        cy="18" 
                        r="15.915" 
                        fill="none" 
                        stroke="#FF2D55" 
                        strokeWidth="3.5" 
                        strokeDasharray={`${(proctorStats.vibeMetrics.strict / proctorStats.vibeMetrics.total) * 100} ${100 - (proctorStats.vibeMetrics.strict / proctorStats.vibeMetrics.total) * 100}`} 
                        strokeDashoffset={-((proctorStats.vibeMetrics.friendly / proctorStats.vibeMetrics.total) * 100)} 
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Primary Vibe</span>
                      <span className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5">
                        {proctorStats.vibeMetrics.friendly >= proctorStats.vibeMetrics.strict ? "Friendly" : "Grill"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#FF6A00]"></span>
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Friendly ({proctorStats.vibeMetrics.friendly})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#FF2D55]"></span>
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Strict ({proctorStats.vibeMetrics.strict})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Helpful ({proctorStats.vibeMetrics.helpful})</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Chart 3: Submission dates timeline area chart */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orange-500" />
                  <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider">Submissions over time</h3>
                </div>

                <div className="relative h-28 flex items-end justify-between gap-1.5 pt-2 w-full min-w-0">
                  {proctorStats.timeline.map((entry, idx) => {
                    const heightPercent = Math.max(15, Math.min(100, (entry.count / results.length) * 100));
                    return (
                      <div key={idx} className="flex-1 min-w-0 flex flex-col items-center gap-1 group">
                        <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[9px] px-2 py-0.5 rounded pointer-events-none">
                          {entry.count} reviews
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-lg h-20 flex items-end overflow-hidden">
                          <div 
                            className="w-full bg-gradient-to-t from-[#FF6A00] to-[#FF2D55] rounded-lg group-hover:brightness-110 transition-all"
                            style={{ height: `${heightPercent}%` }}
                          ></div>
                        </div>
                        <span className="text-[8px] sm:text-[9px] text-slate-400 dark:text-slate-500 font-bold truncate max-w-full block text-center">{entry.date}</span>
                      </div>
                    );
                  })}
                  {proctorStats.timeline.length === 0 && (
                    <div className="text-xs text-slate-400 italic text-center py-6 w-full">No dates recorded.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Filter Controls Accordion Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1 border-t border-slate-200/50 dark:border-slate-800 pt-6">
              
              <div className="flex items-center gap-2.5">
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Student Review Feed</span>
                  <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs px-2.5 py-1 rounded-full font-bold">
                    {filteredAndSortedResults.length} matches
                  </span>
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                    showFilters 
                      ? "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-white" 
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700"
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filters</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`} />
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as "newest" | "oldest" | "helpful")}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs rounded-xl px-2.5 py-1.5 font-bold cursor-pointer focus:outline-hidden"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="helpful">Most Helpful</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Filter Panel */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 rounded-3xl p-5 shadow-xs space-y-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Difficulty</label>
                      <div className="flex gap-1">
                        {["all", "easy", "medium", "hard"].map(level => (
                          <button
                            key={level}
                            onClick={() => setFilterDifficulty(level as any)}
                            className={`flex-1 py-1 px-2.5 rounded-lg border text-xs font-bold transition-all capitalize ${
                              filterDifficulty === level 
                                ? "bg-orange-500 border-orange-500 text-white" 
                                : "bg-slate-50 dark:bg-slate-800/50 border-slate-200/40 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            {level}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Specific Topic</label>
                      <select
                        value={filterTopic}
                        onChange={(e) => setFilterTopic(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-xl px-2.5 py-1.5 font-semibold focus:outline-hidden"
                      >
                        <option value="all">All Topics</option>
                        {allTopicOptions.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Semester Year</label>
                      <select
                        value={filterSemester}
                        onChange={(e) => setFilterSemester(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-xl px-2.5 py-1.5 font-semibold focus:outline-hidden"
                      >
                        <option value="all">All Semesters</option>
                        {allSemesterOptions.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <input
                      type="text"
                      placeholder="Filter reviews by keyword (e.g. 'slots', 'redis', 'celery')..."
                      value={reviewSearchQuery}
                      onChange={(e) => setReviewSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Individual Reviews Grid list */}
            <div className="space-y-4">
              {filteredAndSortedResults.map((record, index) => {
                const diff = getReviewDifficulty(record);
                const topics = getReviewTopics(record);
                const isExpanded = expandedReviews[record.id];
                const isLiked = likedReviews[record.id];
                const helpfulVal = (helpfulCounts[record.id] || 0) + (isLiked ? 1 : 0);

                return (
                  <motion.div
                    key={record.id}
                    layout
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-5 sm:p-6 shadow-xs hover:shadow-lg dark:hover:shadow-none transition-all duration-300 flex flex-col md:flex-row gap-5"
                  >
                    <div className="md:w-1/4 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 pb-4 md:pb-0 md:pr-5 shrink-0">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 text-xs font-black">
                            {index + 1}
                          </div>
                          <div>
                            <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 truncate">
                              {record.studentName}
                            </h4>
                            <span className="text-[10px] text-slate-400 font-bold block mt-0.5">
                              {record.submissionDate || "N/A"}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 mt-3">
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                            diff === "Easy" ? "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/20" :
                            diff === "Hard" ? "text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/20" :
                            "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/20"
                          }`}>
                            {diff}
                          </span>
                          {record.vivaDate && (
                            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200/20 dark:border-slate-700/50">
                              {record.vivaDate}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-[9px] text-slate-400 dark:text-slate-500 font-mono tracking-widest mt-4">
                        Review #{record.id}
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col gap-4">
                      <div>
                        <h5 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" />
                          <span>Questions Asked</span>
                        </h5>
                        <ul className="space-y-2">
                          {record.questions.map((q, qidx) => (
                            <li key={qidx} className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-semibold flex items-start gap-2">
                              <span className="text-orange-500 select-none font-bold mt-0.5">•</span>
                              <span>{q}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {record.suggestions && (
                        <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 p-3 rounded-2xl">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Student Advice</span>
                            <button
                              onClick={() => setExpandedReviews({ ...expandedReviews, [record.id]: !isExpanded })}
                              className="text-[10px] font-bold text-[#FF2D55] hover:underline focus:outline-hidden"
                            >
                              {isExpanded ? "Collapse" : "Expand Advice"}
                            </button>
                          </div>
                          <p className={`text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium ${isExpanded ? 'whitespace-pre-line' : 'line-clamp-2'}`}>
                            {record.suggestions}
                          </p>
                        </div>
                      )}

                      {topics.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {topics.map(t => (
                            <span key={t} className="text-[9px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 mt-auto">
                        <button
                          onClick={() => handleLike(record.id)}
                          className={`flex items-center gap-1.5 text-xs font-bold py-1 px-3.5 rounded-xl border transition-all ${
                            isLiked 
                              ? "bg-rose-50 border-rose-200 text-rose-500 dark:bg-rose-950/20 dark:border-rose-900/40" 
                              : "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-400"
                          }`}
                        >
                          <ThumbsUp className={`w-3.5 h-3.5 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
                          <span>Helpful {helpfulVal > 0 ? `(${helpfulVal})` : ""}</span>
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyToClipboard(record.questions.join("\n"), "Questions")}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl"
                            title="Copy Questions"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              {filteredAndSortedResults.length === 0 && (
                <div className="text-center py-10 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl">
                  <ShieldAlert className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                  <p className="text-xs text-slate-400 font-bold">No submissions match your chosen filters.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="bg-white dark:bg-[#020617] border-t border-slate-200/50 dark:border-slate-900 py-8 text-center text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <span>&copy; {new Date().getFullYear()} MAD2 Viva Proctor Lookup. Built for IITM students.</span>
          <div className="flex items-center gap-5">
            <button onClick={() => setShowShortcutsModal(true)} className="hover:underline font-bold">Shortcuts Menu (?)</button>
            <span>&bull;</span>
            <span className="font-bold text-slate-400 dark:text-slate-600">Database Connected</span>
          </div>
        </div>
      </footer>

      {/* Premium levitating macOS/VisionOS Bottom Dock */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-[95vw] sm:w-auto flex justify-center pointer-events-none">
        <motion.div
          onMouseEnter={() => setIsDockHovered(true)}
          onMouseLeave={() => {
            setIsDockHovered(false);
            setHoveredDockIndex(null);
          }}
          animate={{
            y: isDockHovered ? -4 : 0
          }}
          transition={{
            duration: 0.45,
            ease: [0.22, 1, 0.36, 1]
          }}
          className="pointer-events-auto h-[64px] sm:h-[72px] px-4 sm:px-6 rounded-[999px] flex items-center justify-center gap-2 sm:gap-4 bg-white/10 dark:bg-slate-950/15 backdrop-blur-[30px] border border-white/20 dark:border-slate-800/40 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative"
          style={{
            animation: 'levitate 7s ease-in-out infinite alternate',
          }}
        >
          {/* Subtle reflection overlay (VisionOS UI style) */}
          <div className="absolute inset-0 rounded-[999px] bg-gradient-to-b from-white/10 to-transparent pointer-events-none border border-white/5" />
          
          {[
            { 
              label: "Home", 
              icon: (
                <svg className="w-5 h-5 sm:w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              ),
              onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
              url: null
            },
            { 
              label: "About", 
              icon: (
                <svg className="w-5 h-5 sm:w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              ),
              url: "https://linkedin.com/in/ridhi-sehgal-177890265"
            },
            { 
              label: "Linktree", 
              icon: (
                <svg className="w-5 h-5 sm:w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 13V3" />
                  <path d="M12 13 5 6" />
                  <path d="M12 13 19 6" />
                  <path d="M12 13H4" />
                  <path d="M12 13h8" />
                  <path d="M12 13l-6 6" />
                  <path d="M12 13l6 6" />
                  <path d="M12 17v5" />
                </svg>
              ),
              url: "https://linktr.ee/ridhi13"
            },
            { 
              label: "GitHub", 
              icon: (
                <svg className="w-5 h-5 sm:w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
                </svg>
              ),
              url: "https://github.com/RIDHISEHGAL13/"
            },
            { 
              label: "Portfolio", 
              icon: (
                <svg className="w-5 h-5 sm:w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
                  <path d="M2 12h20"/>
                </svg>
              ),
              url: "https://ridhi.framer.website/"
            },
            { 
              label: "Instagram", 
              icon: (
                <svg className="w-5 h-5 sm:w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                </svg>
              ),
              url: "https://www.instagram.com/ridhi_sehgal1303/"
            },
            { 
              label: "LinkedIn", 
              icon: (
                <svg className="w-5 h-5 sm:w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
                  <rect x="2" y="9" width="4" height="12"/>
                  <circle cx="4" cy="4" r="2"/>
                </svg>
              ),
              url: "https://linkedin.com/in/ridhi-sehgal-177890265"
            }
          ].map((item, i) => {
            const isHovered = hoveredDockIndex === i;
            const isActive = activeDockIndex === i;
            const dist = hoveredDockIndex !== null ? Math.abs(hoveredDockIndex - i) : null;
            
            // macOS Dock proximity magnification scales & translations
            let scale = 1;
            let y = 0;
            let rotate = 0;
            
            if (dist === 0) {
              scale = 1.18;
              y = -10;
              rotate = i % 2 === 0 ? 2 : -2;
            } else if (dist === 1) {
              scale = 1.08;
              y = -4;
            }

            return (
              <motion.a
                key={i}
                href={item.url || "#"}
                target={item.url ? "_blank" : undefined}
                rel="noopener noreferrer"
                onClick={(e) => {
                  setActiveDockIndex(i);
                  if (item.onClick) {
                    e.preventDefault();
                    item.onClick();
                  }
                }}
                onMouseEnter={() => setHoveredDockIndex(i)}
                animate={{
                  scale,
                  y,
                  rotate
                }}
                transition={{
                  type: "spring",
                  stiffness: 250,
                  damping: 18,
                  mass: 0.8
                }}
                className={`relative p-2.5 sm:p-3.5 rounded-full flex items-center justify-center cursor-pointer transition-colors duration-300 z-10 ${
                  isHovered 
                    ? "text-white" 
                    : isActive 
                      ? "text-[#FF6A00] bg-gradient-to-r from-[#FF6A00]/15 to-[#FF2D55]/15 shadow-[0_0_15px_rgba(255,106,0,0.2)] border border-[#FF6A00]/30" 
                      : "text-slate-600 dark:text-slate-400"
                }`}
              >
                {/* Expanding background glow on hover */}
                <motion.span 
                  className="absolute inset-0 rounded-full bg-gradient-to-r from-[#FF6A00] to-[#FF2D55] -z-10 shadow-lg shadow-orange-500/35"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ 
                    scale: isHovered ? 1 : 0,
                    opacity: isHovered ? 1 : 0
                  }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                />

                {item.icon}

                {/* visionOS Tooltip */}
                <AnimatePresence>
                  {isHovered && (
                    <motion.span
                      initial={{ opacity: 0, y: 10, scale: 0.85, x: "-50%" }}
                      animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
                      exit={{ opacity: 0, y: 5, scale: 0.95, x: "-50%" }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="absolute bottom-full left-1/2 mb-3.5 px-3 py-1.5 text-[10px] font-extrabold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-xl shadow-xl whitespace-nowrap z-50 pointer-events-none"
                    >
                      {item.label}
                      <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-white dark:border-t-slate-900"></span>
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.a>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
