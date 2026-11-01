import { Router } from "express";
import { z } from "zod";
import { events } from "../lib/events.js";
import { requireBrowserAuth } from "../middleware/auth.js";
import {
  createCategory,
  removeCategory,
  renameCategory,
} from "../services/topology.service.js";

export const categoriesRouter = Router();
categoriesRouter.use(requireBrowserAuth);

const nameSchema = z.object({
  name: z.string().min(1, "Category name is required."),
});

categoriesRouter.post("/", (request, response) => {
  const body = nameSchema.parse(request.body);
  const category = createCategory(body.name);
  events.emit({ type: "topology", data: {} });
  response.status(201).json({ category });
});

categoriesRouter.patch("/:id", (request, response) => {
  const body = nameSchema.parse(request.body);
  const category = renameCategory(request.params.id, body.name);
  events.emit({ type: "topology", data: {} });
  response.json({ category });
});

categoriesRouter.delete("/:id", (request, response) => {
  removeCategory(request.params.id);
  events.emit({ type: "topology", data: {} });
  events.emit({ type: "agents", data: {} });
  response.json({ deleted: true });
});