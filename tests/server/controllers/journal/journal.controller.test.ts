import { describe, expect, it, vi } from "vitest";
import { createJournalController } from "../../../../server/src/controllers/journal/journal.controller";
import JournalEntity from "../../../../server/src/models/journal.entity";
import MessageEntity from "../../../../server/src/models/message.entity";
import CharacterEntity from "../../../../server/src/models/character.entity";
import { buildAudioId } from "../../../../server/src/services/tts.service";

/**
 * Creates a minimal Express-like response object for unit tests.
 *
 * @returns A mock response with json/status spies.
 */
const createMockResponse = () => {
  const response: any = {};
  response.json = vi.fn();
  response.status = vi.fn(() => response);
  return response;
};

const createRepository = () => ({
  create: vi.fn((payload) => payload),
  save: vi.fn(async (payload) => payload),
  find: vi.fn(),
  findOne: vi.fn()
});

const createController = () => {
  const journalRepository = createRepository();
  const messageRepository = createRepository();
  const characterRepository = createRepository();

  const dataSource = {
    getRepository: vi.fn((entity) => {
      if (entity === JournalEntity) {
        return journalRepository;
      }
      if (entity === MessageEntity) {
        return messageRepository;
      }
      if (entity === CharacterEntity) {
        return characterRepository;
      }
      return createRepository();
    })
  } as any;

  const historyStore = {
    load: vi.fn().mockResolvedValue([]),
    clear: vi.fn().mockResolvedValue(undefined)
  };

  const openAIService = {
    createReply: vi.fn().mockResolvedValue({
      reply: "[{\"CharacterName\":\"Mimi\",\"Text\":\"요약이에요.\",\"Tone\":\"neutral, medium pitch\",\"Translation\":\"Cuoc hoi thoai noi ve...\"}]",
      model: "test-model"
    })
  };

  const controller = createJournalController(dataSource, {
    historyStore: historyStore as any,
    openAIService
  });

  return { controller, journalRepository, messageRepository, characterRepository, historyStore, openAIService };
};

describe("Journal controller", () => {
  it("returns 401 when unauthenticated", async () => {
    const { controller } = createController();
    const response = createMockResponse();

    await controller.listJournals({} as any, response);

    expect(response.status).toHaveBeenCalledWith(401);
  });

  it("lists journals for the user", async () => {
    const { controller, journalRepository } = createController();
    const response = createMockResponse();

    journalRepository.find.mockResolvedValue([
      { id: 1, summary: "Summary", createdAt: new Date("2025-01-01T00:00:00.000Z") }
    ]);

    await controller.listJournals({ user: { id: 1 } } as any, response);

    expect(journalRepository.find).toHaveBeenCalledWith({
      where: { userId: 1 },
      order: { createdAt: "DESC" }
    });
    expect(response.json).toHaveBeenCalledWith({
      journals: [{ id: 1, summary: "Summary", createdAt: "2025-01-01T00:00:00.000Z" }]
    });
  });

  it("filters journals by story", async () => {
    const { controller, journalRepository } = createController();
    const response = createMockResponse();

    journalRepository.find.mockResolvedValue([
      { id: 2, summary: "Summary", createdAt: new Date("2025-01-02T00:00:00.000Z") }
    ]);

    await controller.listJournals({ user: { id: 1 }, query: { storyId: "3" } } as any, response);

    expect(journalRepository.find).toHaveBeenCalledWith({
      where: { userId: 1, storyId: 3 },
      order: { createdAt: "DESC" }
    });
    expect(response.json).toHaveBeenCalledWith({
      journals: [{ id: 2, summary: "Summary", createdAt: "2025-01-02T00:00:00.000Z" }]
    });
  });

  it("returns journal details with messages", async () => {
    const { controller, journalRepository, messageRepository } = createController();
    const response = createMockResponse();

    journalRepository.findOne.mockResolvedValue({
      id: 2,
      summary: "Summary",
      createdAt: new Date("2025-01-02T00:00:00.000Z"),
      userId: 1
    });
    messageRepository.find.mockResolvedValue([
      {
        id: 10,
        content: "Hello",
        characterName: "User",
        translation: null,
        tone: null,
        audio: null,
        createdAt: new Date("2025-01-02T00:00:01.000Z")
      }
    ]);

    await controller.getJournal({ user: { id: 1 }, params: { id: "2" } } as any, response);

    expect(response.json).toHaveBeenCalledWith({
      journal: {
        id: 2,
        summary: "Summary",
        createdAt: "2025-01-02T00:00:00.000Z"
      },
      messages: [
        {
          id: 10,
          content: "Hello",
          characterName: "User",
          translation: null,
          tone: null,
          audio: null,
          createdAt: "2025-01-02T00:00:01.000Z"
        }
      ]
    });
  });

  it("finalizes a journal and clears history", async () => {
    const { controller, journalRepository, messageRepository, characterRepository, historyStore, openAIService } =
      createController();
    const response = createMockResponse();
    characterRepository.find.mockResolvedValue([
      { name: "Mimi", voiceName: "alloy" }
    ]);

    historyStore.load.mockResolvedValue([
      { role: "system", content: "Instruction" },
      { role: "user", content: "Hi" },
      {
        role: "assistant",
        content: "[{\"CharacterName\":\"Mimi\",\"Text\":\"안녕.\",\"Tone\":\"neutral, medium pitch\",\"Translation\":\"Xin chao.\"}]"
      }
    ]);

    journalRepository.save.mockResolvedValue({ id: 5, summary: "Cuoc hoi thoai noi ve...", userId: 1 });

    await controller.endConversation({ user: { id: 1 }, body: { sessionId: "s1" } } as any, response);

    expect(openAIService.createReply).toHaveBeenCalled();
    expect(journalRepository.save).toHaveBeenCalled();
    const savedMessages = messageRepository.save.mock.calls[0]?.[0] as Array<{ translation?: string | null; audio?: string | null }>;
    expect(savedMessages.some((message) => message.translation === "Xin chao.")).toBe(true);
    const expectedAudio = buildAudioId("안녕.", "neutral, medium pitch", "alloy");
    expect(savedMessages.some((message) => message.audio === expectedAudio)).toBe(true);
    expect(historyStore.clear).toHaveBeenCalledWith(1, "s1");
    expect(response.json).toHaveBeenCalledWith({ journalId: 5, summary: "Cuoc hoi thoai noi ve..." });
  });

  it("searches messages by message id", async () => {
    const { controller, journalRepository, messageRepository } = createController();
    const response = createMockResponse();

    journalRepository.find.mockResolvedValue([
      { id: 10, createdAt: new Date("2025-02-01T00:00:00.000Z"), userId: 1 }
    ]);
    messageRepository.find.mockResolvedValue([
      {
        id: "msg-123",
        content: "Hello",
        characterName: "Mimi",
        translation: null,
        tone: null,
        audio: null,
        createdAt: new Date("2025-02-01T00:00:01.000Z")
      }
    ]);

    await controller.searchMessages({ user: { id: 1 }, query: { q: "msg-123" } } as any, response);

    expect(response.json).toHaveBeenCalledWith({
      results: [
        {
          messageId: "msg-123",
          journalId: 10,
          journalDate: "2025-02-01T00:00:00.000Z",
          content: "Hello",
          characterName: "Mimi",
          translation: null,
          tone: null,
          audio: null
        }
      ],
      total: 1,
      hasMore: false
    });
  });

  it("applies assistant edit notes before saving messages", async () => {
    const { controller, journalRepository, messageRepository, characterRepository, historyStore } = createController();
    const response = createMockResponse();

    characterRepository.find.mockResolvedValue([
      { name: "Mimi", voiceName: "alloy" }
    ]);

    historyStore.load.mockResolvedValue([
      { role: "system", content: "Instruction" },
      { role: "user", content: "Hi" },
      {
        role: "assistant",
        content: "[{\"MessageId\":\"msg-999\",\"CharacterName\":\"Mimi\",\"Text\":\"Old text\",\"Tone\":\"neutral, medium pitch\",\"Translation\":\"Cu\"}]"
      },
      {
        role: "developer",
        content: "Assistant message edited: msg-999.\nNew content:\nNew text"
      }
    ]);

    journalRepository.save.mockResolvedValue({ id: 7, summary: "Cuoc hoi thoai noi ve...", userId: 1 });

    await controller.endConversation({ user: { id: 1 }, body: { sessionId: "s1" } } as any, response);

    const savedMessages = messageRepository.save.mock.calls[0]?.[0] as Array<{ content: string; audio?: string | null }>;
    expect(savedMessages.some((message) => message.content === "New text")).toBe(true);
    const expectedAudio = buildAudioId("New text", "neutral, medium pitch", "alloy");
    expect(savedMessages.some((message) => message.audio === expectedAudio)).toBe(true);
  });
});
