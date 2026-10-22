<?php
/**
 * Plugin Name: Blog Revalidate
 * Description: Tells the headless frontend to drop its page cache when content changes.
 *
 * wp-config.php needs:
 *   define('BLOG_REVALIDATE_URL',    'https://www.example.com/blog/revalidate/'); // keep the trailing slash
 *   define('BLOG_REVALIDATE_SECRET', '<same value as the Worker secret REVALIDATE_SECRET>');
 */
if (!defined('ABSPATH')) exit;

// Hooks only mark the request dirty; the ping goes out once, at the very end of the request,
// after the editor has finished saving meta (Rank Math), terms and everything else.
function blog_revalidate_mark() {
    static $armed = false;
    if ($armed) return;
    $armed = true;
    add_action('shutdown', 'blog_revalidate_send');
}

function blog_revalidate_send() {
    if (!defined('BLOG_REVALIDATE_URL') || !defined('BLOG_REVALIDATE_SECRET')) return;
    wp_remote_post(BLOG_REVALIDATE_URL, [
        'timeout'  => 5,
        'blocking' => false,
        'headers'  => [
            'x-revalidate-secret' => BLOG_REVALIDATE_SECRET,
            'content-type'        => 'application/json', // form content types trip Astro's CSRF origin check
        ],
        'body'     => '{}',
    ]);
}

// Posts: publish, update, unpublish, trash.
add_action('transition_post_status', function ($new, $old, $post) {
    if ($post->post_type !== 'post') return;
    if ($new === 'publish' || $old === 'publish') blog_revalidate_mark();
}, 10, 3);
add_action('deleted_post', 'blog_revalidate_mark');

// Categories, tags, authors.
add_action('created_term', 'blog_revalidate_mark');
add_action('edited_term', 'blog_revalidate_mark');
add_action('delete_term', 'blog_revalidate_mark');
add_action('profile_update', 'blog_revalidate_mark');
