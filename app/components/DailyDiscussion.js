'use client'

import CommentThread from './CommentThread'

export default function DailyDiscussion({ dailyId, isAdmin = false, title = "Today's daf discussion" }) {
    return <CommentThread kind="daily" parentId={dailyId} isAdmin={isAdmin} title={title} prompt="Your comment" />
}
