"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StyleProfileSummary = {
  id: number;
  name: string;
  isSystemPreset: boolean;
  createdAt: string;
  updatedAt: string;
};

type ProfilesData = {
  presets: StyleProfileSummary[];
  customs: StyleProfileSummary[];
};

// ── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 animate-pulse space-y-3">
      <div className="h-4 bg-[var(--bg-elevated)] rounded w-3/4" />
      <div className="h-3 bg-[var(--bg-elevated)] rounded w-1/2" />
      <div className="h-5 bg-[var(--bg-elevated)] rounded w-16" />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <div className="h-5 bg-[var(--bg-elevated)] rounded w-24 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2].map((i) => <SkeletonCard key={i} />)}
        </div>
      </div>
      <div className="space-y-4">
        <div className="h-5 bg-[var(--bg-elevated)] rounded w-28 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2].map((i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    </div>
  );
}

// ── Profile Card ──────────────────────────────────────────────────────────────

function ProfileCard({ profile }: { profile: StyleProfileSummary }) {
  const date = new Date(profile.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <Card className="transition-shadow hover:shadow-md hover:shadow-black/10 dark:hover:shadow-black/30">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm leading-tight text-[var(--text)] line-clamp-2">
            {profile.name}
          </h3>
          {profile.isSystemPreset ? (
            <Badge variant="secondary" className="shrink-0 text-xs">Preset</Badge>
          ) : (
            <Badge variant="outline" className="shrink-0 text-xs">Custom</Badge>
          )}
        </div>
        <p className="text-xs text-[var(--text-muted)]">Created {date}</p>
      </CardContent>
    </Card>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyCustoms() {
  return (
    <div className="col-span-full flex flex-col items-center gap-3 py-12 text-center">
      <div className="w-12 h-12 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[var(--text-muted)]"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-medium text-[var(--text)]">No custom styles yet</p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          Use the form above to create your first writing style.
        </p>
      </div>
    </div>
  );
}

// ── Create Form ───────────────────────────────────────────────────────────────

type CreateFormProps = {
  onCreated: () => void;
};

function CreateForm({ onCreated }: CreateFormProps) {
  const [name, setName] = useState("");
  const [sampleTexts, setSampleTexts] = useState<string[]>(["", "", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [sampleTextsError, setSampleTextsError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const addSample = () => {
    if (sampleTexts.length < 5) setSampleTexts((p) => [...p, ""]);
  };

  const removeSample = (idx: number) => {
    if (sampleTexts.length > 3) {
      setSampleTexts((p) => p.filter((_, i) => i !== idx));
    }
  };

  const updateSample = (idx: number, value: string) => {
    setSampleTexts((p) => p.map((t, i) => (i === idx ? value : t)));
    if (sampleTextsError) setSampleTextsError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setNameError(null);
    setSampleTextsError(null);
    setGeneralError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/style-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, sampleTexts }),
      });

      const data = await res.json();

      if (!res.ok) {
        const fields = data?.error?.fields as Record<string, string> | undefined;
        if (fields?.name) setNameError(fields.name);
        if (fields?.sampleTexts) setSampleTextsError(fields.sampleTexts);
        if (!fields || (!fields.name && !fields.sampleTexts)) {
          setGeneralError(data?.error?.message ?? "Something went wrong.");
        }
        return;
      }

      setName("");
      setSampleTexts(["", "", ""]);
      setSuccess(true);
      onCreated();
    } catch {
      setGeneralError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Create a writing style</CardTitle>
        <CardDescription className="text-sm">
          Paste 3–5 samples of your writing. We&apos;ll analyze the tone for you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="style-name">Style name</Label>
            <Input
              id="style-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              placeholder="e.g. My Blog Voice"
              className={cn("w-full", nameError && "border-red-500 focus-visible:ring-red-500")}
            />
            {nameError && <p className="text-xs text-red-500">{nameError}</p>}
          </div>

          {/* Sample texts */}
          <div className="space-y-2">
            <Label>Sample texts ({sampleTexts.length}/5)</Label>
            {sampleTexts.map((text, idx) => (
              <div key={idx} className="flex gap-2 items-start">
                <Textarea
                  value={text}
                  onChange={(e) => updateSample(idx, e.target.value)}
                  placeholder={`Sample ${idx + 1}`}
                  rows={3}
                  className={cn(
                    "w-full resize-none",
                    sampleTextsError && "border-red-500 focus-visible:ring-red-500"
                  )}
                />
                {sampleTexts.length > 3 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSample(idx)}
                    className="shrink-0 mt-1 text-[var(--text-muted)] hover:text-red-500"
                    aria-label="Remove sample"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </Button>
                )}
              </div>
            ))}
            {sampleTextsError && (
              <p className="text-xs text-red-500">{sampleTextsError}</p>
            )}
            {sampleTexts.length < 5 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addSample}
                className="text-xs"
              >
                + Add sample
              </Button>
            )}
          </div>

          {generalError && (
            <p className="text-sm text-red-500">{generalError}</p>
          )}

          {success && (
            <div
              role="status"
              className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm font-medium text-green-400"
            >
              Style created successfully!
            </div>
          )}

          <Button
            type="submit"
            className="w-full min-h-[44px]"
            disabled={submitting}
          >
            {submitting ? "Creating..." : "Create style"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function StyleProfilesPage() {
  const [data, setData] = useState<ProfilesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/style-profiles");
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const json = (await res.json()) as ProfilesData;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load style profiles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProfiles();
  }, [fetchProfiles]);

  return (
    <section className="w-full py-16">
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 space-y-10">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Style Profiles</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Choose a preset or create a custom style based on your own writing samples.
          </p>
        </div>

        {/* Create form */}
        <CreateForm onCreated={fetchProfiles} />

        {/* Error banner */}
        {error && (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
            <p className="text-sm text-red-400">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchProfiles}
              className="shrink-0 border-red-500/40 text-red-400 hover:bg-red-500/10 min-h-[44px]"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <LoadingSkeleton />
        ) : data ? (
          <div className="space-y-10">
            {/* Presets */}
            <div className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Presets
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.presets.map((p) => (
                  <ProfileCard key={p.id} profile={p} />
                ))}
              </div>
            </div>

            {/* Your styles */}
            <div className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Your styles
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.customs.length === 0 ? (
                  <EmptyCustoms />
                ) : (
                  data.customs.map((p) => <ProfileCard key={p.id} profile={p} />)
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
