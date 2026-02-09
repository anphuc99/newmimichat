interface VocabularySearchProps {
  value: string;
  onChange: (query: string) => void;
}

/**
 * Renders a search input for filtering vocabulary items.
 *
 * @param props - Search dependencies.
 * @returns The search component.
 */
const VocabularySearch = ({ value, onChange }: VocabularySearchProps) => {
  return (
    <div className="vocab-search">
      <input
        type="text"
        className="vocab-search__input"
        placeholder="Search Korean or Vietnamese..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value.trim() ? (
        <button
          type="button"
          className="vocab-search__clear"
          onClick={() => onChange("")}
        >
          ✕
        </button>
      ) : null}
    </div>
  );
};

export default VocabularySearch;
