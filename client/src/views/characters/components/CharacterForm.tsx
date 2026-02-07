type CharacterGender = "male" | "female";

import { OPENAI_VOICES, type OpenAIVoiceValue } from "../voiceOptions";

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

interface CharacterFormProps {
  formState: CharacterFormState;
  onChange: (next: CharacterFormState) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onAvatarUpload: (file: File) => void;
  isSaving: boolean;
  isUploading: boolean;
  isEditing: boolean;
}

/**
 * Renders the character create/edit form.
 *
 * @param props - Dependencies injected from Characters view.
 * @returns The character form component.
 */
const CharacterForm = ({
  formState,
  onChange,
  onSubmit,
  onCancel,
  onAvatarUpload,
  isSaving,
  isUploading,
  isEditing
}: CharacterFormProps) => {
  const updateField = <K extends keyof CharacterFormState>(key: K, value: CharacterFormState[K]) => {
    onChange({
      ...formState,
      [key]: value
    });
  };

  return (
    <section className="character-form">
      <div className="character-form__header">
        <h2>{isEditing ? "Edit character" : "Create character"}</h2>
        {isEditing ? (
          <button type="button" className="ghost" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>

      <div className="character-form__grid">
        <label>
          Name
          <input
            type="text"
            value={formState.name}
            onChange={(event) => updateField("name", event.target.value)}
            placeholder="Mimi"
          />
        </label>
        <label>
          Gender
          <select
            value={formState.gender}
            onChange={(event) => updateField("gender", event.target.value as CharacterGender)}
          >
            <option value="female">female</option>
            <option value="male">male</option>
          </select>
        </label>
        <label className="full">
          Personality
          <textarea
            rows={3}
            value={formState.personality}
            onChange={(event) => updateField("personality", event.target.value)}
            placeholder="Warm, patient, and encouraging."
          />
        </label>
        <label className="full">
          Appearance
          <input
            type="text"
            value={formState.appearance}
            onChange={(event) => updateField("appearance", event.target.value)}
            placeholder="Short hair, cozy sweater"
          />
        </label>
        <label className="full">
          Avatar
          <div className="character-form__avatar">
            <div className="character-form__avatar-preview">
              {formState.avatar ? <img src={formState.avatar} alt="Avatar preview" /> : <span>?</span>}
            </div>
            <div className="character-form__avatar-actions">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    onAvatarUpload(file);
                  }
                }}
              />
              <small>{isUploading ? "Uploading..." : "Upload a square image for best results."}</small>
            </div>
          </div>
        </label>
      </div>

      <div className="character-form__divider">Voice (optional)</div>

      <div className="character-form__grid">
        <label>
          Voice name
          <select
            value={formState.voiceName as OpenAIVoiceValue}
            onChange={(event) => updateField("voiceName", event.target.value)}
          >
            {OPENAI_VOICES.map((voice) => (
              <option key={voice.value} value={voice.value}>
                {voice.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Pitch
          <input
            type="number"
            value={formState.pitch}
            onChange={(event) => updateField("pitch", event.target.value)}
            placeholder="0"
            step="0.1"
          />
        </label>
        <label>
          Speaking rate
          <input
            type="number"
            value={formState.speakingRate}
            onChange={(event) => updateField("speakingRate", event.target.value)}
            placeholder="1.0"
            step="0.1"
          />
        </label>
      </div>

      <div className="character-form__actions">
        <button type="button" onClick={onSubmit} disabled={isSaving}>
          {isSaving ? "Saving..." : isEditing ? "Save changes" : "Add character"}
        </button>
      </div>
    </section>
  );
};

export default CharacterForm;
