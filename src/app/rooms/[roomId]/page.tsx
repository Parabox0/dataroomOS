import { redirect } from "next/navigation";

export default async function RoomHome({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  redirect(`/rooms/${roomId}/checklist`);
}
