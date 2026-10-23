<?php
/**
 * Plugin Name: PDFMech Vercel Publisher
 * Description: Queues a PDFMech production rebuild when a published WordPress post is created or updated.
 * Version: 1.0.0
 * Author: PDFMech
 */

if (!defined('ABSPATH')) {
    exit;
}

const PDFMECH_VERCEL_PUBLISH_LOCK = 'pdfmech_vercel_publish_lock';

/** Queue one deploy request after the current WordPress save is complete. */
function pdfmech_queue_vercel_publish_request() {
    static $queued = false;

    if ($queued) {
        return;
    }

    $queued = true;
    add_action('shutdown', 'pdfmech_trigger_vercel_publish', 100);
}

/**
 * Trigger one deployment after WordPress has finished saving the post.
 *
 * Repeated saves made while WordPress is updating a post collapse into the same
 * deployment because the request handler uses a short transient lock.
 */
function pdfmech_publish_on_post_save($post_id, $post, $update) {
    unset($update);

    if (
        !($post instanceof WP_Post) ||
        $post->post_type !== 'post' ||
        $post->post_status !== 'publish' ||
        wp_is_post_revision($post_id) ||
        wp_is_post_autosave($post_id)
    ) {
        return;
    }

    pdfmech_queue_vercel_publish_request();
}
add_action('save_post_post', 'pdfmech_publish_on_post_save', 20, 3);

/** Rebuild when a public article is published, unpublished, or trashed. */
function pdfmech_publish_on_status_transition($new_status, $old_status, $post) {
    if (
        !($post instanceof WP_Post) ||
        $post->post_type !== 'post' ||
        $new_status === $old_status ||
        ($new_status !== 'publish' && $old_status !== 'publish') ||
        wp_is_post_revision($post->ID) ||
        wp_is_post_autosave($post->ID)
    ) {
        return;
    }

    pdfmech_queue_vercel_publish_request();
}
add_action('transition_post_status', 'pdfmech_publish_on_status_transition', 20, 3);

/**
 * Ask Vercel to rebuild PDFMech from the configured production branch.
 *
 * The deploy-hook URL is read only from wp-config.php. It is never stored in a
 * post, option, rendered page, JavaScript bundle, or repository file.
 */
function pdfmech_trigger_vercel_publish() {
    if (get_transient(PDFMECH_VERCEL_PUBLISH_LOCK)) {
        return;
    }

    $hook_url = defined('PDFMECH_VERCEL_DEPLOY_HOOK_URL')
        ? trim((string) PDFMECH_VERCEL_DEPLOY_HOOK_URL)
        : '';

    if (!$hook_url || !wp_http_validate_url($hook_url)) {
        error_log('PDFMech publish hook is not configured with a valid HTTPS URL.');
        return;
    }

    $scheme = wp_parse_url($hook_url, PHP_URL_SCHEME);
    $host = wp_parse_url($hook_url, PHP_URL_HOST);
    if ($scheme !== 'https' || $host !== 'api.vercel.com') {
        error_log('PDFMech publish hook must use an api.vercel.com HTTPS URL.');
        return;
    }

    set_transient(PDFMECH_VERCEL_PUBLISH_LOCK, '1', MINUTE_IN_SECONDS);

    $response = wp_remote_post(
        $hook_url,
        array(
            'timeout' => 15,
            'redirection' => 0,
            'headers' => array(
                'Accept' => 'application/json',
                'User-Agent' => 'PDFMech-WordPress-Publisher/1.0',
            ),
        )
    );

    if (is_wp_error($response)) {
        delete_transient(PDFMECH_VERCEL_PUBLISH_LOCK);
        error_log('PDFMech Vercel publish request failed: ' . $response->get_error_message());
        return;
    }

    $status = wp_remote_retrieve_response_code($response);
    if ($status < 200 || $status >= 300) {
        delete_transient(PDFMECH_VERCEL_PUBLISH_LOCK);
        error_log('PDFMech Vercel publish request returned HTTP ' . (int) $status . '.');
    }
}

