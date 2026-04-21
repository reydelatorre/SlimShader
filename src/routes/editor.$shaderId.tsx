import { createFileRoute } from "@tanstack/react-router";
import { EditorPage } from "../components/EditorPage";

export const Route = createFileRoute("/editor/$shaderId")({
    component: EditorPage,
});
