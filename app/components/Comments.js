'use client'

import CommentThread from './CommentThread'

export default function Comments({ articleId }) {
    return <CommentThread kind="article" parentId={articleId} title="Questions on this article" />
}
