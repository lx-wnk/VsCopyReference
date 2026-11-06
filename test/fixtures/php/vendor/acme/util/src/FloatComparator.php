<?php

namespace Acme\Util;

class FloatComparator extends ComparatorBase
{
    public const EPSILON = 0.0001;

    public $tolerance = 0.5;

    public static function lessThanOrEquals(float $a, float $b): bool
    {
        return $a <= $b;
    }
}

function helper()
{
}
