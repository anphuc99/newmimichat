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
}

interface CharacterCardProps {
  character: Character;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * Renders a character summary card.
 *
 * @param props - Dependencies injected from Characters view.
 * @returns The character card component.
 */
const CharacterCard = ({ character, onEdit, onDelete }: CharacterCardProps) => {
  return (
    <article className="character-card">
      <div className="character-card__header">
        <div className="character-card__avatar">
          {character.avatar ? (
            <img src={character.avatar} alt={character.name} />
          ) : (
            <span>{character.name.slice(0, 1).toUpperCase()}</span>
          )}
        </div>
        <div>
          <h3>{character.name}</h3>
          <p className="character-card__meta">{character.gender}</p>
        </div>
      </div>
      <p className="character-card__personality">{character.personality}</p>
      {character.appearance ? (
        <p className="character-card__appearance">{character.appearance}</p>
      ) : null}
      <div className="character-card__footer">
        <div>
          <span className="character-card__tag">{character.voiceModel ?? "openai"}</span>
          {character.voiceName ? (
            <span className="character-card__tag">{character.voiceName}</span>
          ) : null}
        </div>
        <div className="character-card__actions">
          <button type="button" onClick={onEdit}>
            Edit
          </button>
          <button type="button" className="danger" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>
    </article>
  );
};

export default CharacterCard;
