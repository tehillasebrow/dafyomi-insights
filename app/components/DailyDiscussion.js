'use client'

import CommentThread from './CommentThread'

export default function DailyDiscussion({ dailyId, title = "Today's daf discussion" }) {
    return <CommentThread kind="daily" parentId={dailyId} title={title} prompt="Your comment" />
}
