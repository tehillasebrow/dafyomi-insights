'use client'

import CommentThread from './CommentThread'

export default function Comments({ articleId, isAdmin = false }) {
    return <CommentThread kind="article" parentId={articleId} isAdmin={isAdmin} title="Questions on this article" />
}
