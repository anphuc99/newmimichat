import { useEffect, useState } from "react";
import { apiUrl } from "../../lib/api";
import { authFetch } from "../../lib/auth";

interface Story {
  id: number;
  name: string;
  description: string;
  currentProgress: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StoryResponse {
  story: Story;
}

interface StoryListResponse {
  stories: Story[];
}

/**
 * Renders the Story management view.
 *
 * @returns The Story view React component.
 */
const StoryView = () => {
  const [stories, setStories] = useState<Story[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newProgress, setNewProgress] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editProgress, setEditProgress] = useState("");

  /**
   * Loads the latest stories for the current user.
   */
  const loadStories = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authFetch(apiUrl("/api/stories"));

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Failed to load stories");
      }

      const payload = (await response.json()) as StoryListResponse;
      setStories(payload.stories ?? []);
    } catch (caught) {
      console.error("Failed to load stories.", caught);
      setError(caught instanceof Error ? caught.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadStories();
  }, []);

  const resetCreateForm = () => {
    setNewName("");
    setNewDescription("");
    setNewProgress("");
  };

  const handleCreateStory = async () => {
    if (!newName.trim() || !newDescription.trim()) {
      setError("Name and description are required");
      return;
    }

    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await authFetch(apiUrl("/api/stories"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim(),
          currentProgress: newProgress.trim() || null
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Failed to create story");
      }

      const payload = (await response.json()) as StoryResponse;
      setStories((prev) => [payload.story, ...prev]);
      resetCreateForm();
      setNotice("Story created.");
    } catch (caught) {
      console.error("Failed to create story.", caught);
      setError(caught instanceof Error ? caught.message : "Unknown error");
    } finally {
      setIsSaving(false);
    }
  };

  const beginEdit = (story: Story) => {
    setEditingId(story.id);
    setEditName(story.name);
    setEditDescription(story.description);
    setEditProgress(story.currentProgress ?? "");
    setNotice(null);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditDescription("");
    setEditProgress("");
  };

  const handleUpdateStory = async () => {
    if (!editingId) {
      return;
    }

    if (!editName.trim() || !editDescription.trim()) {
      setError("Name and description are required");
      return;
    }

    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await authFetch(apiUrl(`/api/stories/${editingId}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim(),
          currentProgress: editProgress.trim() || null
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Failed to update story");
      }

      const payload = (await response.json()) as StoryResponse;
      setStories((prev) => prev.map((story) => (story.id === editingId ? payload.story : story)));
      cancelEdit();
      setNotice("Story updated.");
    } catch (caught) {
      console.error("Failed to update story.", caught);
      setError(caught instanceof Error ? caught.message : "Unknown error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteStory = async (storyId: number) => {
    const story = stories.find((item) => item.id === storyId);
    if (!story || !window.confirm(`Delete story "${story.name}"?`)) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await authFetch(apiUrl(`/api/stories/${storyId}`), {
        method: "DELETE"
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Failed to delete story");
      }

      setStories((prev) => prev.filter((item) => item.id !== storyId));
      if (editingId === storyId) {
        cancelEdit();
      }
      setNotice("Story deleted.");
    } catch (caught) {
      console.error("Failed to delete story.", caught);
      setError(caught instanceof Error ? caught.message : "Unknown error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="story-shell">
      <header className="story-header">
        <div>
          <p className="story-kicker">Story</p>
          <h1>Track your story progress</h1>
          <p className="story-subtitle">Group journals into stories and keep an updated progress note.</p>
        </div>
      </header>

      {error ? <p className="story-error">{error}</p> : null}
      {notice ? <p className="story-notice">{notice}</p> : null}

      <section className="story-layout">
        <div className="story-panel">
          <h2>Create story</h2>
          <div className="story-form">
            <label>
              Name
              <input value={newName} onChange={(event) => setNewName(event.target.value)} />
            </label>
            <label>
              Description
              <textarea
                rows={4}
                value={newDescription}
                onChange={(event) => setNewDescription(event.target.value)}
              />
            </label>
            <label>
              Current progress
              <textarea
                rows={3}
                value={newProgress}
                onChange={(event) => setNewProgress(event.target.value)}
              />
            </label>
            <button type="button" onClick={handleCreateStory} disabled={isSaving}>
              {isSaving ? "Saving..." : "Create story"}
            </button>
          </div>
        </div>

        <div className="story-panel">
          <div className="story-panel__header">
            <h2>Your stories</h2>
            <span>{stories.length} stories</span>
          </div>
          {isLoading ? <p className="story-muted">Loading stories...</p> : null}
          {!isLoading && stories.length === 0 ? (
            <p className="story-muted">No stories yet. Create one to start grouping journals.</p>
          ) : (
            <ul className="story-list">
              {stories.map((story) => {
                const isEditing = editingId === story.id;

                return (
                  <li key={story.id} className="story-card">
                    {isEditing ? (
                      <div className="story-edit">
                        <label>
                          Name
                          <input value={editName} onChange={(event) => setEditName(event.target.value)} />
                        </label>
                        <label>
                          Description
                          <textarea
                            rows={3}
                            value={editDescription}
                            onChange={(event) => setEditDescription(event.target.value)}
                          />
                        </label>
                        <label>
                          Current progress
                          <textarea
                            rows={3}
                            value={editProgress}
                            onChange={(event) => setEditProgress(event.target.value)}
                          />
                        </label>
                        <div className="story-card__actions">
                          <button type="button" onClick={handleUpdateStory} disabled={isSaving}>
                            {isSaving ? "Saving..." : "Save"}
                          </button>
                          <button type="button" className="ghost" onClick={cancelEdit} disabled={isSaving}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <h3>{story.name}</h3>
                          <p className="story-card__description">{story.description}</p>
                          <p className="story-card__progress">
                            {story.currentProgress?.trim() ? story.currentProgress : "No progress yet."}
                          </p>
                        </div>
                        <div className="story-card__actions">
                          <button type="button" onClick={() => beginEdit(story)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="danger"
                            onClick={() => handleDeleteStory(story.id)}
                            disabled={isSaving}
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
};

export default StoryView;
