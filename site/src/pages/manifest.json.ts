import { getCollection } from 'astro:content';

export async function GET() {
  const posts = (await getCollection('posts')).sort((a, b) => a.data.number - b.data.number);

  const manifest = posts.map((post) => ({
    number: post.data.number,
    title: post.data.title,
    slug: post.id,
    submolt: post.data.submolt || null,
  }));

  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/json' },
  });
}
