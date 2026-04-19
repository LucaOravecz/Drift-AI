import { MeetingService } from "@/lib/services/meeting.service";
import { MeetingsClient } from "@/components/meetings-client";

export const revalidate = 0;

export default async function MeetingsPage() {
  const meetings = await MeetingService.getMeetings();
  return <MeetingsClient meetings={meetings as any} />;
}
