type CharacterGender = "male" | "female";

type VoiceModel = "openai" | "elevenlabs";

interface CharacterFormState {
  name: string;
  personality: string;
  gender: CharacterGender;
  appearance: string;
  avatar: string;
  voiceModel: VoiceModel;
  voiceName: string;
  pitch: string;
  speakingRate: string;
}

interface CharacterFormProps {
  formState: CharacterFormState;
  onChange: (next: CharacterFormState) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isSaving: boolean;
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
  isSaving,
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
          Avatar URL
          <input
            type="url"
            value={formState.avatar}
            onChange={(event) => updateField("avatar", event.target.value)}
            placeholder="https://..."
          />
        </label>
      </div>

      <div className="character-form__divider">Voice (optional)</div>

      <div className="character-form__grid">
        <label>
          Voice model
          <select
            value={formState.voiceModel}
            onChange={(event) => updateField("voiceModel", event.target.value as VoiceModel)}
          >
            <option value="openai">openai</option>
            <option value="elevenlabs">elevenlabs</option>
          </select>
        </label>
        <label>
          Voice name
          <input
            type="text"
            value={formState.voiceName}
            onChange={(event) => updateField("voiceName", event.target.value)}
            placeholder="alloy"
          />
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
