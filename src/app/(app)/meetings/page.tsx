import { MeetingService } from "@/lib/services/meeting.service";
import { MeetingsClient } from "@/components/meetings-client";

export const revalidate = 0;

export default async function MeetingsPage() {
  const [meetings, upcoming] = await Promise.all([
    MeetingService.getMeetings(),
    MeetingService.getUpcoming(),
  ]);
  return <MeetingsClient meetings={meetings as any} upcoming={upcoming as any} />;
}
