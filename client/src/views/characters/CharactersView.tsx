import { useEffect, useMemo, useState } from "react";
import CharacterCard from "./components/CharacterCard";
import CharacterForm from "./components/CharacterForm";
import { apiUrl } from "../../lib/api";
import { authFetch } from "../../lib/auth";
import { OPENAI_VOICES } from "./voiceOptions";

type CharacterGender = "male" | "female";
type VoiceModel = "openai";

interface Character {
  id: number;
  name: string;
  personality: string;
  gender: CharacterGender;
  appearance?: string | null;
  avatar?: string | null;
  voiceModel?: VoiceModel | null;
  voiceName?: string | null;
  pitch?: number | null;
  speakingRate?: number | null;
  createdAt: string;
  updatedAt: string;
}

interface CharacterFormState {
  name: string;
  personality: string;
  gender: CharacterGender;
  appearance: string;
  avatar: string;
  voiceName: string;
  pitch: string;
  speakingRate: string;
}

const emptyFormState = (): CharacterFormState => ({
  name: "",
  personality: "",
  gender: "female",
  appearance: "",
  avatar: "",
  voiceName: OPENAI_VOICES[0]?.value ?? "",
  pitch: "",
  speakingRate: ""
});

const buildPayload = (form: CharacterFormState) => {
  const parseNumber = (value: string) => {
    if (!value.trim()) {
      return null;
    }

    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  return {
    name: form.name.trim(),
    personality: form.personality.trim(),
    gender: form.gender,
    appearance: form.appearance.trim() || null,
    avatar: form.avatar.trim() || null,
    voiceModel: form.voiceName.trim() ? "openai" : null,
    voiceName: form.voiceName.trim() || null,
    pitch: parseNumber(form.pitch),
    speakingRate: parseNumber(form.speakingRate)
  };
};

/**
 * Renders the character management view.
 *
 * @returns The Characters view React component.
 */
const CharactersView = () => {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [formState, setFormState] = useState<CharacterFormState>(emptyFormState);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedCharacters = useMemo(() => {
    return [...characters].sort((left, right) => right.id - left.id);
  }, [characters]);

  useEffect(() => {
    let isMounted = true;

    const loadCharacters = async () => {
      try {
        const response = await authFetch(apiUrl("/api/characters"));

        if (!response.ok) {
          throw new Error("Failed to load characters");
        }

        const payload = (await response.json()) as Character[];

        if (isMounted) {
          setCharacters(payload);
        }
      } catch (caught) {
        if (isMounted) {
          setError(caught instanceof Error ? caught.message : "Unknown error");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadCharacters();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleEdit = (character: Character) => {
    setEditingId(character.id);
    setFormState({
      name: character.name,
      personality: character.personality,
      gender: character.gender,
      appearance: character.appearance ?? "",
      avatar: character.avatar ?? "",
      voiceName: character.voiceName ?? (OPENAI_VOICES[0]?.value ?? ""),
      pitch: character.pitch?.toString() ?? "",
      speakingRate: character.speakingRate?.toString() ?? ""
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormState(emptyFormState());
  };

  const handleAvatarUpload = async (file: File) => {
    setIsUploading(true);
    setError(null);

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read image"));
        reader.readAsDataURL(file);
      });

      const response = await authFetch(apiUrl("/api/characters/upload-avatar"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ image: dataUrl, filename: file.name })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Failed to upload avatar");
      }

      const payload = (await response.json()) as { url: string };

      setFormState((prev) => ({
        ...prev,
        avatar: payload.url
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unknown error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (character: Character) => {
    if (!window.confirm(`Delete ${character.name}?`)) {
      return;
    }

    try {
      const response = await authFetch(apiUrl(`/api/characters/${character.id}`), {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("Failed to delete character");
      }

      setCharacters((prev) => prev.filter((item) => item.id !== character.id));
      if (editingId === character.id) {
        handleCancel();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unknown error");
    }
  };

  const handleSubmit = async () => {
    if (!formState.name.trim() || !formState.personality.trim()) {
      setError("Name and personality are required");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const payload = buildPayload(formState);
      const response = await authFetch(
        apiUrl(editingId ? `/api/characters/${editingId}` : "/api/characters"),
        {
          method: editingId ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(errorPayload?.message ?? "Failed to save character");
      }

      const saved = (await response.json()) as Character;

      setCharacters((prev) => {
        if (editingId) {
          return prev.map((item) => (item.id === saved.id ? saved : item));
        }

        return [saved, ...prev];
      });

      handleCancel();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unknown error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="characters-shell">
      <header className="characters-header">
        <div>
          <p className="characters-kicker">Character Manager</p>
          <h1>Build your MimiChat cast</h1>
          <p className="characters-subtitle">Create, edit, and organize AI personas.</p>
        </div>
      </header>

      {error ? <p className="characters-error">{error}</p> : null}

      <section className="characters-layout">
        <div className="characters-panel">
          <CharacterForm
            formState={formState}
            onChange={setFormState}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            onAvatarUpload={handleAvatarUpload}
            isSaving={isSaving}
            isUploading={isUploading}
            isEditing={editingId !== null}
          />
        </div>

        <div className="characters-panel">
          <div className="characters-list-header">
            <h2>Characters</h2>
            <span>{sortedCharacters.length} total</span>
          </div>
          {isLoading ? (
            <p className="characters-muted">Loading characters...</p>
          ) : sortedCharacters.length === 0 ? (
            <p className="characters-muted">No characters yet. Add one to get started.</p>
          ) : (
            <div className="characters-list">
              {sortedCharacters.map((character) => (
                <CharacterCard
                  key={character.id}
                  character={character}
                  onEdit={() => handleEdit(character)}
                  onDelete={() => handleDelete(character)}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
};

export default CharactersView;
