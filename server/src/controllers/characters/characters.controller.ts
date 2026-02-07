import type { Request, Response } from "express";
import type { DataSource } from "typeorm";
import CharacterEntity from "../../models/character.entity.js";

type CharacterGender = "male" | "female";

interface CharacterPayload {
  name: string;
  personality: string;
  gender: CharacterGender;
  appearance?: string | null;
  avatar?: string | null;
  voiceModel?: string | null;
  voiceName?: string | null;
  pitch?: number | null;
  speakingRate?: number | null;
}

interface CharacterResponse extends CharacterPayload {
  id: number;
  createdAt: string;
  updatedAt: string;
}

interface CharactersController {
  listCharacters: (request: Request, response: Response) => Promise<void>;
  createCharacter: (request: Request, response: Response) => Promise<void>;
  updateCharacter: (request: Request, response: Response) => Promise<void>;
  deleteCharacter: (request: Request, response: Response) => Promise<void>;
}

const isValidGender = (value: unknown): value is CharacterGender => {
  return value === "male" || value === "female";
};

const toResponse = (entity: CharacterEntity): CharacterResponse => ({
  id: entity.id,
  name: entity.name,
  personality: entity.personality,
  gender: entity.gender,
  appearance: entity.appearance ?? null,
  avatar: entity.avatar ?? null,
  voiceModel: entity.voiceModel ?? null,
  voiceName: entity.voiceName ?? null,
  pitch: entity.pitch ?? null,
  speakingRate: entity.speakingRate ?? null,
  createdAt: entity.createdAt.toISOString(),
  updatedAt: entity.updatedAt.toISOString()
});

const parseId = (value: string) => {
  const id = Number.parseInt(value, 10);
  return Number.isNaN(id) ? null : id;
};

/**
 * Builds the Characters controller with injected data source dependencies.
 *
 * @param dataSource - Initialized TypeORM data source.
 * @returns The Characters controller handlers.
 */
export const createCharactersController = (dataSource: DataSource): CharactersController => {
  const repository = dataSource.getRepository(CharacterEntity);

  const listCharacters: CharactersController["listCharacters"] = async (_request, response) => {
    try {
      const characters = await repository.find({
        order: {
          createdAt: "DESC"
        }
      });

      response.json(characters.map(toResponse));
    } catch (error) {
      response.status(500).json({
        message: "Failed to load characters",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  const createCharacter: CharactersController["createCharacter"] = async (request, response) => {
    const payload = request.body as CharacterPayload;
    const name = typeof payload?.name === "string" ? payload.name.trim() : "";
    const personality = typeof payload?.personality === "string" ? payload.personality.trim() : "";
    const gender = payload?.gender;

    if (!name || !personality || !isValidGender(gender)) {
      response.status(400).json({
        message: "Name, personality, and gender are required"
      });
      return;
    }

    try {
      const character = repository.create({
        name,
        personality,
        gender,
        appearance: payload?.appearance ?? null,
        avatar: payload?.avatar ?? null,
        voiceModel: payload?.voiceModel ?? null,
        voiceName: payload?.voiceName ?? null,
        pitch: payload?.pitch ?? null,
        speakingRate: payload?.speakingRate ?? null
      });

      const saved = await repository.save(character);

      response.status(201).json(toResponse(saved));
    } catch (error) {
      response.status(500).json({
        message: "Failed to create character",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  const updateCharacter: CharactersController["updateCharacter"] = async (request, response) => {
    const id = parseId(request.params.id);

    if (!id) {
      response.status(400).json({
        message: "Invalid character id"
      });
      return;
    }

    const payload = request.body as CharacterPayload;
    const name = typeof payload?.name === "string" ? payload.name.trim() : "";
    const personality = typeof payload?.personality === "string" ? payload.personality.trim() : "";
    const gender = payload?.gender;

    if (!name || !personality || !isValidGender(gender)) {
      response.status(400).json({
        message: "Name, personality, and gender are required"
      });
      return;
    }

    try {
      const character = await repository.findOne({ where: { id } });

      if (!character) {
        response.status(404).json({
          message: "Character not found"
        });
        return;
      }

      character.name = name;
      character.personality = personality;
      character.gender = gender;
      character.appearance = payload?.appearance ?? null;
      character.avatar = payload?.avatar ?? null;
      character.voiceModel = payload?.voiceModel ?? null;
      character.voiceName = payload?.voiceName ?? null;
      character.pitch = payload?.pitch ?? null;
      character.speakingRate = payload?.speakingRate ?? null;

      const saved = await repository.save(character);

      response.json(toResponse(saved));
    } catch (error) {
      response.status(500).json({
        message: "Failed to update character",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  const deleteCharacter: CharactersController["deleteCharacter"] = async (request, response) => {
    const id = parseId(request.params.id);

    if (!id) {
      response.status(400).json({
        message: "Invalid character id"
      });
      return;
    }

    try {
      const character = await repository.findOne({ where: { id } });

      if (!character) {
        response.status(404).json({
          message: "Character not found"
        });
        return;
      }

      await repository.remove(character);
      response.status(204).send();
    } catch (error) {
      response.status(500).json({
        message: "Failed to delete character",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  return {
    listCharacters,
    createCharacter,
    updateCharacter,
    deleteCharacter
  };
};
